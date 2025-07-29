terraform {
  required_version = ">= 1.0"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "expert-contacts-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Variables
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudtasks.googleapis.com",
    "workflows.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com"
  ])
  
  service = each.key
  disable_on_destroy = false
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.region
  repository_id = "expert-contacts-${var.environment}"
  description   = "Docker repository for Expert Contacts microservice"
  format        = "DOCKER"
  
  depends_on = [google_project_service.required_apis]
}

# Cloud SQL Instance
resource "google_sql_database_instance" "postgres" {
  name             = "expert-contacts-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  
  settings {
    tier = var.environment == "prod" ? "db-g1-small" : "db-f1-micro"
    
    backup_configuration {
      enabled                        = true
      start_time                     = "02:00"
      location                       = var.region
      point_in_time_recovery_enabled = var.environment == "prod"
    }
    
    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }
  
  deletion_protection = var.environment == "prod"
  
  depends_on = [google_project_service.required_apis]
}

# Database
resource "google_sql_database" "database" {
  name     = "expert_contacts"
  instance = google_sql_database_instance.postgres.name
}

# Database User
resource "google_sql_user" "app_user" {
  name     = "app_user"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Secret Manager Secrets
resource "google_secret_manager_secret" "db_password" {
  secret_id = "expert-contacts-db-password-${var.environment}"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "expert-contacts-openai-key-${var.environment}"
  
  replication {
    auto {}
  }
  
  depends_on = [google_project_service.required_apis]
}

# Cloud Tasks Queue
resource "google_cloud_tasks_queue" "expert_sourcing" {
  name     = "expert-sourcing-${var.environment}"
  location = var.region
  
  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 2
  }
  
  retry_config {
    max_attempts = 3
    max_retry_duration = "600s"
    min_backoff = "10s"
    max_backoff = "300s"
  }
  
  depends_on = [google_project_service.required_apis]
}

# Service Account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "expert-contacts-run-${var.environment}"
  display_name = "Expert Contacts Cloud Run Service Account"
}

# IAM Roles for Cloud Run Service Account
resource "google_project_iam_member" "cloud_run_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/cloudtasks.enqueuer",
    "roles/workflows.invoker",
    "roles/storage.objectAdmin"
  ])
  
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Storage Bucket for raw outputs
resource "google_storage_bucket" "raw_outputs" {
  name     = "${var.project_id}-expert-contacts-outputs-${var.environment}"
  location = var.region
  
  uniform_bucket_level_access = true
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
  
  depends_on = [google_project_service.required_apis]
}

# Cloud Run Service
resource "google_cloud_run_service" "api" {
  name     = "expert-contacts-api-${var.environment}"
  location = var.region
  
  template {
    spec {
      service_account_name = google_service_account.cloud_run.email
      
      containers {
        image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/expert-contacts:latest"
        
        ports {
          container_port = 8080
        }
        
        env {
          name  = "NODE_ENV"
          value = var.environment
        }
        
        env {
          name  = "GCP_PROJECT_ID"
          value = var.project_id
        }
        
        env {
          name  = "GCP_REGION"
          value = var.region
        }
        
        env {
          name  = "TASK_QUEUE_NAME"
          value = google_cloud_tasks_queue.expert_sourcing.name
        }
        
        env {
          name  = "CLOUD_SQL_CONNECTION_NAME"
          value = google_sql_database_instance.postgres.connection_name
        }
        
        env {
          name  = "DB_NAME"
          value = google_sql_database.database.name
        }
        
        env {
          name  = "DB_USER"
          value = google_sql_user.app_user.name
        }
        
        env {
          name = "DB_PASSWORD"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.db_password.secret_id
              key  = "latest"
            }
          }
        }
        
        env {
          name = "OPENAI_API_KEY"
          value_from {
            secret_key_ref {
              name = google_secret_manager_secret.openai_api_key.secret_id
              key  = "latest"
            }
          }
        }
        
        resources {
          limits = {
            cpu    = var.environment == "prod" ? "2" : "1"
            memory = var.environment == "prod" ? "2Gi" : "1Gi"
          }
        }
      }
      
      # Cloud SQL Proxy sidecar
      containers {
        image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.7.1"
        args = [
          "--private-ip",
          "--port=5432",
          google_sql_database_instance.postgres.connection_name
        ]
      }
    }
    
    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = var.environment == "prod" ? "1" : "0"
        "autoscaling.knative.dev/maxScale" = var.environment == "prod" ? "10" : "5"
        "run.googleapis.com/execution-environment" = "gen2"
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  depends_on = [
    google_project_service.required_apis,
    google_artifact_registry_repository.docker_repo
  ]
}

# Allow unauthenticated access to the API (you may want to change this for production)
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.api.name
  location = google_cloud_run_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Outputs
output "service_url" {
  value = google_cloud_run_service.api.status[0].url
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}