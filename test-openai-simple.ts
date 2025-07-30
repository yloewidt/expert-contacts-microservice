import dotenv from 'dotenv';
import { OpenAIService } from './src/services/openai';

dotenv.config();

async function testExpertTypes() {
  console.log('Testing Expert Type Generation...\n');
  
  const openAIService = new OpenAIService();
  const projectDescription = `
    I'm building a B2B SaaS platform that helps small to medium-sized manufacturing companies 
    optimize their supply chain management using AI-powered demand forecasting and inventory 
    optimization. The platform will integrate with existing ERP systems and provide real-time 
    insights on inventory levels, supplier performance, and demand patterns.
  `;
  
  const expertTypes = await openAIService.generateExpertTypes(projectDescription);
  console.log('Expert Types:', JSON.stringify(expertTypes, null, 2));
}

testExpertTypes().catch(console.error);