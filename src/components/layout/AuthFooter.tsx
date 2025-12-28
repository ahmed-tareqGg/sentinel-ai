import { Linkedin, Github, Mail, MessageCircle, Shield } from 'lucide-react';

const socialLinks = [
  { icon: Mail, href: 'mailto:tarekaboya2019@gmail.com', label: 'Email' },
  { icon: Linkedin, href: 'https://www.linkedin.com/in/ah-m-ed-tareq-48069523b/', label: 'LinkedIn' },
  { icon: Github, href: 'https://github.com/Palestine-1', label: 'GitHub' },
  { icon: Shield, href: 'https://tryhackme.com/p/ahmedtareq', label: 'TryHackMe' },
  { icon: MessageCircle, href: 'https://wa.me/201559181558', label: 'WhatsApp' },
];

export function AuthFooter() {
  return (
    <div className="mt-8 pt-6 border-t border-border/30">
      <div className="flex justify-center gap-4 mb-4">
        {socialLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all"
            aria-label={link.label}
          >
            <link.icon className="h-4 w-4" />
          </a>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Built by Ahmed Tarek
      </p>
      <p className="text-center text-xs text-muted-foreground mt-1">
        © 2025 SOCMind. All rights reserved.
      </p>
    </div>
  );
}
