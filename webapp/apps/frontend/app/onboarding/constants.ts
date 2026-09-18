export const INDUSTRY_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'education', label: 'Education' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'entertainment', label: 'Entertainment & Media' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'aerospace', label: 'Aerospace & Defense' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'government', label: 'Government & Public Sector' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'other', label: 'Other' },
]

export const COMPANY_SIZE_OPTIONS = [
  { value: 'just_me', label: 'Just me', description: 'Solo entrepreneur or individual' },
  { value: '2-10', label: '2-10 employees', description: 'Small team' },
  { value: '11-50', label: '11-50 employees', description: 'Growing startup' },
  { value: '51-200', label: '51-200 employees', description: 'Mid-size company' },
  { value: '201-1000', label: '201-1,000 employees', description: 'Large company' },
  { value: '1000+', label: '1,000+ employees', description: 'Enterprise' },
]

export const JOB_TITLE_OPTIONS = [
  // Tech roles
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'developer', label: 'Developer' },
  { value: 'frontend_developer', label: 'Frontend Developer' },
  { value: 'backend_developer', label: 'Backend Developer' },
  { value: 'full_stack_developer', label: 'Full Stack Developer' },
  { value: 'mobile_developer', label: 'Mobile Developer' },
  { value: 'devops_engineer', label: 'DevOps Engineer' },
  { value: 'qa_engineer', label: 'QA Engineer' },
  { value: 'data_scientist', label: 'Data Scientist' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'designer', label: 'Designer' },
  { value: 'ui_ux_designer', label: 'UI/UX Designer' },
  { value: 'cto', label: 'CTO' },
  { value: 'tech_lead', label: 'Tech Lead' },
  
  // Marketing & Business
  { value: 'marketer', label: 'Marketer' },
  { value: 'social_media_manager', label: 'Social Media Manager' },
  { value: 'marketing_manager', label: 'Marketing Manager' },
  { value: 'ceo', label: 'CEO' },
  { value: 'founder', label: 'Founder' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'business_analyst', label: 'Business Analyst' },
  { value: 'project_manager', label: 'Project Manager' },
  
  // Service & Delivery
  { value: 'rideshare_driver', label: 'Rideshare Driver' },
  { value: 'food_delivery', label: 'Food Delivery' },
  { value: 'delivery_driver', label: 'Delivery Driver' },
  
  // Other common roles
  { value: 'student', label: 'Student' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'entrepreneur', label: 'Entrepreneur' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'sales', label: 'Sales' },
  { value: 'customer_support', label: 'Customer Support' },
]
