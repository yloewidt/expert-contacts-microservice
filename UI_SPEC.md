# UI Specification Document

## Overview
The Expert Contacts Microservice UI is a modern, responsive web application that allows users to create expert sourcing requests and view results. The UI emphasizes clarity, efficiency, and professional aesthetics.

## Design Principles
1. **Clean and Professional**: Minimalist design with focus on content
2. **Responsive**: Works seamlessly on desktop, tablet, and mobile devices
3. **Accessible**: WCAG 2.1 AA compliant
4. **Real-time Updates**: Auto-refresh for job status changes
5. **User Feedback**: Clear loading states and error handling

## Color Palette
- **Primary**: #2563eb (Blue)
- **Primary Hover**: #1d4ed8
- **Success**: #10b981 (Green)
- **Warning**: #f59e0b (Orange)
- **Error**: #ef4444 (Red)
- **Background**: #f9fafb
- **Surface**: #ffffff
- **Text Primary**: #111827
- **Text Secondary**: #6b7280
- **Border**: #e5e7eb

## Typography
- **Font Family**: Inter, system-ui, -apple-system, sans-serif
- **Headings**: 
  - H1: 2.25rem (36px), font-weight: 700
  - H2: 1.875rem (30px), font-weight: 600
  - H3: 1.5rem (24px), font-weight: 600
- **Body**: 1rem (16px), line-height: 1.5
- **Small**: 0.875rem (14px)

## Layout Structure

### 1. Header
- Fixed position with white background
- Logo/Brand name on the left
- Navigation items on the right
- Height: 64px
- Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)

### 2. Main Content Area
- Max-width: 1280px
- Centered with padding: 24px
- Three main views: Jobs List, Job Details, Create Job

### 3. Navigation
- Tab-based navigation below header
- Active tab indicator with primary color
- Smooth transitions between views

## Component Specifications

### Jobs List View

#### Job Card
- White background with rounded corners (8px)
- Padding: 24px
- Margin bottom: 16px
- Shadow: 0 1px 3px rgba(0, 0, 0, 0.1)
- Hover effect: Slight elevation and border color change

**Content Structure:**
1. **Header Row**
   - Project description (truncated to 2 lines)
   - Status badge (right-aligned)
   
2. **Metadata Row**
   - Created date
   - Processing time
   - Expert count
   
3. **Progress Indicator** (for processing jobs)
   - Linear progress bar
   - Animated pulse effect

4. **Click Action**
   - Entire card is clickable
   - Cursor: pointer
   - Navigate to job details

#### Status Badges
- Pill-shaped with colored background
- States:
  - Pending: Gray background
  - Processing: Blue background with pulse animation
  - Completed: Green background
  - Failed: Red background

### Job Details View

#### Back Navigation
- Arrow icon + "Back to Jobs" text
- Positioned at top of view
- Click returns to jobs list

#### Job Information Section
- **Header**: Project description (full text)
- **Status**: Large status badge with icon
- **Metadata Grid** (2 columns on desktop, 1 on mobile):
  - Created date
  - Processing time
  - Total experts found
  - Expert types identified

#### LLM Health Indicator
- Small dot indicator with tooltip
- Colors: Green (healthy), Yellow (warning), Red (error)
- Shows success rate on hover

#### Expert Type Filter
- Horizontal scrollable pills
- "All" option selected by default
- Shows count for each type
- Click to filter experts

#### Experts Grid
- Responsive grid (3 columns desktop, 2 tablet, 1 mobile)
- Gap: 24px

#### Expert Card
- White background, rounded corners (8px)
- Padding: 20px
- Shadow on hover

**Structure:**
1. **Header**
   - Name (font-weight: 600)
   - Relevance score badge (right-aligned)
   
2. **Professional Info**
   - Title
   - Company
   - LinkedIn icon + link
   
3. **Expertise Pills**
   - Small, colored tags
   - Max 3 visible, "+X more" if exceeded
   
4. **Matching Reasons**
   - Bullet list with checkmarks
   - Collapsible if > 3 items
   
5. **Actions Section**
   - "View Message" button (expands personalized message)
   - "Copy LinkedIn" button
   - "Copy Email" button (if available)

#### Personalized Message Modal
- Overlay with dark background (opacity: 0.5)
- White modal, max-width: 600px
- Close button (X) in top-right
- Message in monospace font
- "Copy Message" button at bottom

### Create Job View

#### Form Container
- White background, rounded corners
- Max-width: 800px, centered
- Padding: 32px

#### Form Fields

1. **Project Description**
   - Textarea, 6 rows minimum
   - Placeholder: "Describe your project and the type of experts you're looking for..."
   - Character counter (bottom-right)
   - Max length: 2000 characters

2. **Effort Level**
   - Radio button group with descriptions
   - Options:
     - Low: "Quick search, ~5 minutes"
     - Medium: "Standard search, ~10 minutes" (default)
     - High: "Comprehensive search, ~15 minutes"

3. **Advanced Options** (collapsible)
   - Industry focus (multi-select)
   - Geographic preference
   - Years of experience range

4. **Submit Button**
   - Full width on mobile, auto width on desktop
   - Primary color with hover effect
   - Loading state with spinner
   - Disabled state when form is invalid

#### Success State
- Green success message
- "View Job" button
- Auto-redirect after 3 seconds

## Interaction Patterns

### Loading States
1. **Skeleton Screens**: For initial page loads
2. **Spinners**: For actions (submit, refresh)
3. **Progress Bars**: For processing jobs
4. **Shimmer Effects**: For loading cards

### Error Handling
1. **Toast Notifications**: For temporary errors
2. **Inline Errors**: For form validation
3. **Error Page**: For critical failures
4. **Retry Buttons**: For recoverable errors

### Animations
1. **Page Transitions**: Fade in/out (200ms)
2. **Card Hover**: Scale(1.02) and shadow increase
3. **Button Hover**: Background color change (150ms)
4. **Processing Pulse**: 2s infinite animation
5. **Success Checkmark**: SVG path animation

## Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Accessibility Requirements
1. **Keyboard Navigation**: Full support with visible focus indicators
2. **Screen Readers**: Proper ARIA labels and roles
3. **Color Contrast**: Minimum 4.5:1 for normal text
4. **Focus Management**: Logical tab order
5. **Error Announcements**: Live regions for dynamic content

## Performance Targets
- Initial Load: < 2s
- Time to Interactive: < 3s
- Smooth scrolling: 60fps
- API Response Feedback: < 100ms

## Browser Support
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari: iOS 12+
- Chrome Mobile: Android 6+