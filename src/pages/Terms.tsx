import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { GlobalFooter } from '@/components/layout/GlobalFooter';
import { FileText } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      {/* Header */}
      <section className="py-16 px-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 p-3 rounded-full bg-primary/10 mb-6">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">Terms of Service</h1>
          <p className="text-muted-foreground">Last updated: December 2025</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto prose prose-invert">
          <div className="space-y-8">
            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">1. Platform Usage</h2>
              <p className="text-muted-foreground leading-relaxed">
                SOCMind is a security operations platform designed for authorized security professionals. 
                By accessing and using this platform, you agree to use it solely for legitimate security 
                operations, incident response, and threat management purposes. Unauthorized use, including 
                any attempt to misuse the platform for malicious activities, is strictly prohibited.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">2. Incident Data Ownership</h2>
              <p className="text-muted-foreground leading-relaxed">
                All incident data, security logs, and analysis results generated within your organization's 
                instance of SOCMind remain the exclusive property of your organization. SOCMind does not 
                claim ownership over any security data processed through the platform. You retain full 
                control and responsibility for your security data.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">3. Simulated Actions & Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                SOCMind provides automated response capabilities including playbook execution and 
                containment actions. While these features are designed to enhance security operations, 
                SOCMind assumes no liability for the outcomes of automated or simulated actions. Users 
                are responsible for configuring and approving automated responses according to their 
                organization's policies and risk tolerance.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">4. User Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed">
                Users are responsible for maintaining the security of their account credentials, 
                ensuring appropriate access controls are in place, and using the platform in accordance 
                with applicable laws and regulations. Users must promptly report any security incidents 
                or unauthorized access to their SOCMind instance.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">5. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                SOCMind strives to maintain high availability for all platform services. However, 
                scheduled maintenance, updates, and unforeseen technical issues may occasionally 
                affect service availability. We will provide advance notice for planned maintenance 
                whenever possible.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-card border border-border">
              <h2 className="text-xl font-bold text-foreground mb-4">6. Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions regarding these terms, please contact us at{' '}
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
