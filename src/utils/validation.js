import Joi from 'joi';

export const schemas = {
  // Expert sourcing request
  sourceExperts: Joi.object({
    projectDescription: Joi.string().min(10).max(5000).required(),
    userId: Joi.string().optional()
  }),

  // Search experts
  searchExperts: Joi.object({
    query: Joi.string().min(1).max(200).optional(),
    minConfidence: Joi.number().min(0).max(10).optional(),
    source: Joi.string().valid('ai_suggested', 'manual', 'verified').optional(),
    skills: Joi.array().items(Joi.string()).optional(),
    limit: Joi.number().min(1).max(100).optional()
  }),

  // Update contact status
  updateContactStatus: Joi.object({
    status: Joi.string().valid('contacted', 'responded', 'declined', 'scheduled').required(),
    notes: Joi.string().max(1000).optional()
  }),

  // ID parameters
  idParam: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

export const validate = (schema) => {
  return (req, res, next) => {
    const validationTarget = req.method === 'GET' ? req.query : req.body;
    const { error, value } = schema.validate(validationTarget);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    
    // Replace with validated values
    if (req.method === 'GET') {
      req.query = value;
    } else {
      req.body = value;
    }
    
    next();
  };
};

export const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params);
    
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    
    req.params = value;
    next();
  };
};