import { Link } from 'react-router-dom';
import { Linkedin, Github, Mail, MessageCircle, Facebook, Shield } from 'lucide-react';

const socialLinks = [
  { 
    icon: Mail, 
    href: 'mailto:tarekaboya2019@gmail.com', 
    label: 'Email' 
  },
  { 
    icon: Linkedin, 
    href: 'https://www.linkedin.com/in/ah-m-ed-tareq-48069523b/', 
    label: 'LinkedIn' 
  },
  { 
    icon: Github, 
    href: 'https://github.com/Palestine-1', 
    label: 'GitHub' 
  },
  { 
    icon: Shield, 
    href: 'https://tryhackme.com/p/ahmedtareq', 
    label: 'TryHackMe' 
  },
  { 
    icon: MessageCircle, 
    href: 'https://wa.me/201559181558', 
    label: 'WhatsApp' 
  },
  { 
    icon: Facebook, 
    href: 'https://facebook.com', 
    label: 'Facebook' 
  },
];

export function GlobalFooter() {
  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-foreground">SOCMind</h3>
            <p className="text-sm text-muted-foreground">
              Autonomous Security Operations Center powered by AI-driven detection and response.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Platform</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                About
              </Link>
              <Link to="/how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                How It Works
              </Link>
              <Link to="/trust" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Trust & Security
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <nav className="flex flex-col gap-2">
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Privacy Policy
              </Link>
            </nav>
          </div>

          {/* Social */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Connect</h4>
            <div className="flex gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-secondary/50 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all"
                  aria-label={link.label}
                >
                  <link.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">
            © 2025 SOCMind. Built by Ahmed Tarek
          </p>
          <a
            href="https://discord.com/users/palestine71023"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Discord: palestine71023
          </a>
        </div>
      </div>
    </footer>
  );
}
