import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { GlobalFooter } from '@/components/layout/GlobalFooter';
import { Shield } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      {/* Header */}
      <section className="py-16 px-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 p-3 rounded-full bg-primary/10 mb-6">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: December 2025</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">1. Log Data Handling</h2>
              <p className="text-muted-foreground leading-relaxed">
                Security logs and incident data are processed securely within the SOCMind platform. 
                All data is encrypted at rest using AES-256 encryption and in transit using TLS 1.3. 
                Log data is retained according to your organization's configured retention policies 
                and can be deleted upon request.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">2. No Resale of Data</h2>
              <p className="text-muted-foreground leading-relaxed">
                SOCMind will never sell, rent, or share your security data with third parties for 
                commercial purposes. Your incident data, threat intelligence, and security logs are 
                used exclusively to provide and improve the platform's services for your organization.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">3. Encryption & Access Control</h2>
              <p className="text-muted-foreground leading-relaxed">
                All data within SOCMind is protected by enterprise-grade encryption. Access to data 
                is strictly controlled through role-based access control (RBAC) with support for 
                Admin, SOC Analyst, and Viewer roles. All access is logged and auditable for 
                compliance purposes.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">4. Compliance</h2>
              <p className="text-muted-foreground leading-relaxed">
                SOCMind is designed with compliance in mind. The platform supports requirements for 
                common security frameworks including SOC 2, ISO 27001, and GDPR. Comprehensive audit 
                logs track all user actions and system events for regulatory compliance.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">5. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                Incident data and security logs are retained according to your organization's 
                configured policies. Default retention is 90 days, with options for extended 
                retention periods. Data can be exported or deleted upon authorized request.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">6. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                For privacy-related inquiries, please contact our security team at{' '}
                <a href="mailto:tarekaboya2019@gmail.com" className="text-primary hover:underline">
                  tarekaboya2019@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <GlobalFooter />
    </div>
  );
}
