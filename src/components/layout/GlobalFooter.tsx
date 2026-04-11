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
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-2 md:col-span-1 space-y-4">
            <h3 className="text-lg font-bold text-foreground">SOCMind</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Autonomous Security Operations Center powered by AI-driven detection and response.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Platform</h4>
            <nav className="flex flex-col gap-2">
              <Link 
                to="/about" 
                onClick={scrollToTop}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                About
              </Link>
              <Link 
                to="/how-it-works" 
                onClick={scrollToTop}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                How It Works
              </Link>
              <Link 
                to="/trust" 
                onClick={scrollToTop}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Trust & Security
              </Link>
              <Link 
                to="/resume" 
                onClick={scrollToTop}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Resume
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Legal</h4>
            <nav className="flex flex-col gap-2">
              <Link 
                to="/terms" 
                onClick={scrollToTop}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Terms of Service
              </Link>
              <Link 
                to="/privacy" 
                onClick={scrollToTop}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <button
                onClick={() => { import('@/lib/demoGuideGenerator').then(m => m.generateDemoGuidePDF()); }}
                className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                📘 Demo Guide
              </button>
            </nav>
          </div>

          {/* Social */}
          <div className="col-span-2 sm:col-span-1 space-y-3 sm:space-y-4">
            <h4 className="text-sm font-semibold text-foreground">Connect</h4>
            <div className="flex flex-wrap gap-2 sm:gap-3">
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

        <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
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
