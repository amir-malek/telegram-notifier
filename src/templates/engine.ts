import Handlebars from 'handlebars';
import { Template } from '../types';
import { logger } from '../monitoring/logger';
import { metrics } from '../monitoring/metrics';

export interface RenderedTemplate {
  subject?: string;
  content: string;
  usedVariables: string[];
  missingVariables: string[];
}

export interface TemplateContext {
  [key: string]: any;
}

export class TemplateEngine {
  private static instance: TemplateEngine;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  private constructor() {
    this.setupHelpers();
  }

  static getInstance(): TemplateEngine {
    if (!TemplateEngine.instance) {
      TemplateEngine.instance = new TemplateEngine();
    }
    return TemplateEngine.instance;
  }

  private setupHelpers(): void {
    // Date formatting helper
    Handlebars.registerHelper('formatDate', (date: Date, format: string = 'YYYY-MM-DD') => {
      if (!date) return '';

      try {
        const d = new Date(date);

        switch (format) {
          case 'YYYY-MM-DD':
            return d.toISOString().split('T')[0];
          case 'DD/MM/YYYY':
            return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
          case 'human':
            return d.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          case 'time':
            return d.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
          case 'datetime':
            return d.toLocaleString('en-US');
          default:
            return d.toISOString();
        }
      } catch (error) {
        logger.error('Date formatting error:', error);
        return date.toString();
      }
    });

    // Number formatting helper
    Handlebars.registerHelper('formatNumber', (number: number, decimals: number = 0) => {
      if (typeof number !== 'number') return number;
      return number.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    });

    // Currency formatting helper
    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string = 'USD') => {
      if (typeof amount !== 'number') return amount;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase()
      }).format(amount);
    });

    // String manipulation helpers
    Handlebars.registerHelper('uppercase', (str: string) => {
      return typeof str === 'string' ? str.toUpperCase() : str;
    });

    Handlebars.registerHelper('lowercase', (str: string) => {
      return typeof str === 'string' ? str.toLowerCase() : str;
    });

    Handlebars.registerHelper('capitalize', (str: string) => {
      if (typeof str !== 'string') return str;
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    Handlebars.registerHelper('truncate', (str: string, length: number = 100, suffix: string = '...') => {
      if (typeof str !== 'string') return str;
      if (str.length <= length) return str;
      return str.substring(0, length) + suffix;
    });

    // Conditional helpers
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('gte', (a: any, b: any) => a >= b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('lte', (a: any, b: any) => a <= b);

    // Array helpers
    Handlebars.registerHelper('join', (array: any[], separator: string = ', ') => {
      if (!Array.isArray(array)) return array;
      return array.join(separator);
    });

    Handlebars.registerHelper('first', (array: any[], count: number = 1) => {
      if (!Array.isArray(array)) return array;
      return count === 1 ? array[0] : array.slice(0, count);
    });

    Handlebars.registerHelper('last', (array: any[], count: number = 1) => {
      if (!Array.isArray(array)) return array;
      return count === 1 ? array[array.length - 1] : array.slice(-count);
    });

    // URL encoding helper
    Handlebars.registerHelper('urlEncode', (str: string) => {
      return typeof str === 'string' ? encodeURIComponent(str) : str;
    });

    // Safe JSON helper
    Handlebars.registerHelper('json', (obj: any) => {
      try {
        return new Handlebars.SafeString(JSON.stringify(obj));
      } catch (error) {
        return '{}';
      }
    });

    // Default value helper
    Handlebars.registerHelper('default', (value: any, defaultValue: any) => {
      return value != null && value !== '' ? value : defaultValue;
    });
  }

  async render(template: Template, context: TemplateContext): Promise<RenderedTemplate> {
    const startTime = Date.now();

    try {
      // Compile template if not cached
      const cacheKey = `${template.id}-${template.updatedAt?.getTime()}`;
      let compiledTemplate = this.compiledTemplates.get(cacheKey);

      if (!compiledTemplate) {
        compiledTemplate = Handlebars.compile(template.content, {
          strict: false, // Allow missing variables
          noEscape: template.channel === 'html' // Don't escape HTML for HTML templates
        });

        this.compiledTemplates.set(cacheKey, compiledTemplate);

        // Clean up old compiled templates
        if (this.compiledTemplates.size > 1000) {
          const keysToDelete = Array.from(this.compiledTemplates.keys()).slice(0, 100);
          keysToDelete.forEach(key => this.compiledTemplates.delete(key));
        }
      }

      // Render the template
      const renderedContent = compiledTemplate(context);

      // Analyze variable usage
      const analysis = this.analyzeVariableUsage(template, context);

      const result: RenderedTemplate = {
        content: renderedContent,
        usedVariables: analysis.used,
        missingVariables: analysis.missing
      };

      // Render subject if it exists (for email templates)
      if (template.channel === 'email' && context.subject) {
        const subjectTemplate = Handlebars.compile(context.subject);
        result.subject = subjectTemplate(context);
      }

      const processingTime = Date.now() - startTime;

      metrics.recordTemplateRender(template.name, 'success');

      logger.debug('Template rendered successfully', {
        templateId: template.id,
        templateName: template.name,
        channel: template.channel,
        processingTime: `${processingTime}ms`,
        usedVariables: analysis.used.length,
        missingVariables: analysis.missing.length
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;

      metrics.recordTemplateRender(template.name, 'failed');

      logger.error('Template rendering failed', {
        templateId: template.id,
        templateName: template.name,
        channel: template.channel,
        processingTime: `${processingTime}ms`,
        error: (error as Error).message
      });

      throw new Error(`Template rendering failed: ${(error as Error).message}`);
    }
  }

  private analyzeVariableUsage(template: Template, context: TemplateContext): {
    used: string[];
    missing: string[];
  } {
    const templateVariables = new Set(template.variables || []);
    const contextKeys = new Set(Object.keys(context));

    const used: string[] = [];
    const missing: string[] = [];

    // Find variables that are defined in template and present in context
    templateVariables.forEach(variable => {
      if (contextKeys.has(variable)) {
        used.push(variable);
      } else {
        missing.push(variable);
      }
    });

    return { used, missing };
  }

  validate(templateContent: string): {
    isValid: boolean;
    errors: string[];
    variables: string[];
  } {
    try {
      // Compile template to check for syntax errors
      const compiled = Handlebars.compile(templateContent, { strict: false });

      // Extract variables from template
      const variables = this.extractVariables(templateContent);

      return {
        isValid: true,
        errors: [],
        variables
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [(error as Error).message],
        variables: []
      };
    }
  }

  private extractVariables(templateContent: string): string[] {
    const variables = new Set<string>();

    // Match Handlebars expressions: {{variable}} or {{#each variable}}
    const handlebarsRegex = /\{\{(?:#\w+\s+)?(\w+)(?:\.[^}]+)?\}\}/g;
    let match;

    while ((match = handlebarsRegex.exec(templateContent)) !== null) {
      const variable = match[1];
      // Skip built-in helpers
      if (!['if', 'unless', 'each', 'with', 'lookup', 'formatDate', 'formatNumber',
           'formatCurrency', 'uppercase', 'lowercase', 'capitalize', 'truncate',
           'eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'join', 'first', 'last',
           'urlEncode', 'json', 'default'].includes(variable)) {
        variables.add(variable);
      }
    }

    return Array.from(variables);
  }

  clearCache(): void {
    this.compiledTemplates.clear();
    logger.info('Template cache cleared');
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.compiledTemplates.size,
      keys: Array.from(this.compiledTemplates.keys())
    };
  }
}

// Pre-defined templates for common use cases
export const defaultTemplates = {
  telegram: {
    jobAlert: {
      name: 'job_alert',
      channel: 'telegram',
      content: `🆕 *New Job Alert*

*{{title}}*
🏢 {{company}}
📍 {{location}}
{{#if salary}}💰 {{salary}}{{/if}}

{{#if description}}{{truncate description 200}}{{/if}}

🔗 [View Job]({{url}})`,
      variables: ['title', 'company', 'location', 'salary', 'description', 'url']
    },

    batchJobs: {
      name: 'batch_jobs',
      channel: 'telegram',
      content: `🔥 *{{count}} New Jobs Found!*

{{#each jobs}}
{{@index}}. *{{title}}* at {{company}}
   📍 {{location}}
   🔗 [View]({{url}})

{{/each}}`,
      variables: ['count', 'jobs']
    }
  },

  email: {
    jobAlert: {
      name: 'job_alert',
      channel: 'email',
      content: `
<h2>New Job Alert</h2>
<h3>{{title}}</h3>
<p><strong>Company:</strong> {{company}}</p>
<p><strong>Location:</strong> {{location}}</p>
{{#if salary}}<p><strong>Salary:</strong> {{salary}}</p>{{/if}}

{{#if description}}
<div>
  <h4>Description:</h4>
  <p>{{description}}</p>
</div>
{{/if}}

<p><a href="{{url}}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">View Job</a></p>
`,
      variables: ['title', 'company', 'location', 'salary', 'description', 'url']
    }
  }
};