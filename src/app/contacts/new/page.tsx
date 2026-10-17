import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewContactPage() {
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-block text-sm text-muted-foreground hover:text-foreground">
        ← Все контакты
      </Link>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-xl">Новый контакт</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm />
        </CardContent>
      </Card>
    </div>
  );
}
