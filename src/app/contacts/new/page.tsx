import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Container } from "@/components/container";

export default function NewContactPage() {
  return (
    <Container className="flex flex-col gap-8 pt-10 pb-16 lg:gap-12 lg:pt-16 lg:pb-24">
      <div className="flex flex-col gap-4 lg:gap-6">
        <BackLink />
        <h1 className="font-display text-title font-bold">Новый контакт</h1>
      </div>
      <ContactForm />
    </Container>
  );
}
