import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@droiduse/shared-ui/accordion';

const FAQS = [
  {
    question: 'What are tokens?',
    answer: 'Tokens represent the amount of AI processing you can use each month. Different operations consume different amounts of tokens based on complexity.',
  },
  {
    question: 'Can I change my plan later?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing period.',
  },
  {
    question: 'What happens if I exceed my token limit?',
    answer: 'When you reach your token limit, you will need to upgrade to a higher tier or wait until your tokens reset at the start of the next billing period.',
  },
  {
    question: 'Do you offer refunds?',
    answer: 'We offer a 14-day money-back guarantee for new subscriptions. Contact our support team if you are not satisfied.',
  },
  {
    question: 'Can I cancel my subscription?',
    answer: 'Yes, you can cancel anytime from your account dashboard. Your access continues until the end of your current billing period.',
  },
];

export function PricingFAQ() {
  return (
    <div className="mx-auto max-w-3xl">
      <Accordion type="single" collapsible>
        {FAQS.map((faq, index) => (
          <AccordionItem key={index} value={`item-${index}`}>
            <AccordionTrigger className="text-left">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
