import { motion } from 'framer-motion';
import { 
  Shield, Mail, Phone, MapPin, Github, Linkedin, MessageCircle, 
  Download, Award, GraduationCap, Briefcase, Code, Globe, 
  ChevronRight, ExternalLink, Star, Trophy, Target, Server,
  FileText, BookOpen, Cpu, Lock, Network, Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import founderImage from '@/assets/founder-ahmed-tarek.png';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
};

const skills = [
  { category: 'Security Operations', icon: Shield, items: ['Threat Detection', 'Incident Response', 'Log Analysis', 'SIEM', 'CTF'] },
  { category: 'Tools & Technologies', icon: Terminal, items: ['FortiSIEM', 'QRadar', 'Wireshark', 'Nmap', 'Metasploit', 'Burp Suite'] },
  { category: 'Network Security', icon: Network, items: ['TCP/IP', 'OSI Model', 'Firewall', 'VPN', 'IDS/IPS', 'Cisco Networking'] },
  { category: 'Operating Systems', icon: Server, items: ['Windows Server', 'Linux (Ubuntu, Kali)', 'System Hardening'] },
  { category: 'Programming', icon: Code, items: ['Python', 'Bash', 'JavaScript', 'React', 'SQL'] },
  { category: 'Compliance & GRC', icon: Lock, items: ['NIST Framework', 'ISO 27001', 'GDPR', 'Risk Assessment'] },
];

const certifications = [
  { name: 'eCIR – Certified Incident Responder', issuer: 'eLearnSecurity / INE', status: 'In Progress', highlight: true },
  { name: 'Fortinet NSE4 – Network Security Professional', issuer: 'Fortinet', status: 'In Progress', highlight: true },
  { name: 'CCNA v7 (Cisco Certified Network Associate)', issuer: 'NTI', status: 'Score: 80%' },
  { name: 'Red Hat System Administration I (RH124)', issuer: 'Red Hat', status: '40 Credit Hours' },
  { name: 'eJPT – Junior Penetration Tester', issuer: 'Netriders Academy', status: 'Completed' },
  { name: 'SANS SEC450: Blue Team Fundamentals', issuer: 'Netriders Academy', status: 'Completed' },
  { name: 'CompTIA Security+ (Sec+)', issuer: 'Netriders Academy', status: 'Completed' },
  { name: 'Ethical Hacker', issuer: 'Cisco Networking Academy', status: '2025' },
  { name: 'Network Security', issuer: 'Cisco Networking Academy', status: '2025' },
  { name: 'Python Essentials 1 & 2', issuer: 'Cisco Networking Academy', status: '2025' },
  { name: 'Introduction to Cybersecurity', issuer: 'Cisco Networking Academy', status: '2025' },
  { name: 'Web Development Using React JS (120 Hours)', issuer: 'ITI', status: '2024' },
];

const experiences = [
  {
    title: 'SOC & Penetration Testing Trainee',
    company: 'National Telecommunication Institute (NTI)',
    period: 'Sep 2025 – Feb 2026',
    duration: '600 Hours',
    highlights: [
      'Monitored 500+ daily security events using FortiSIEM and IBM QRadar',
      'Reduced incident response time by 30% following SOC playbooks',
      'Conducted log analysis and threat hunting across 10+ data sources',
      'Executed 15+ Red Team exercises including vulnerability scanning and penetration testing',
      'Analyzed network traffic using Wireshark to detect 20+ potential intrusion attempts',
      'Delivered 10+ cybersecurity briefings improving stakeholder understanding by 30%',
    ],
  },
  {
    title: 'Frontend Developer Trainee',
    company: 'Information Technology Institute (ITI)',
    period: 'Aug 2024 – Sep 2024',
    duration: '120 Hours',
    highlights: [
      'Delivered 5+ responsive web applications using React JS, HTML5, CSS3, and JavaScript',
      'Achieved 95%+ Lighthouse accessibility scores',
      'Reduced load times by 35% through code splitting and lazy loading',
    ],
  },
];

const projects = [
  {
    title: 'SOCMind Platform',
    tech: 'React, TypeScript, Data Visualization',
    description: 'Security Operations Dashboard',
    highlights: [
      'Processing 1,000+ security events for real-time threat monitoring',
      'Built 8+ chart types and alert management systems',
      'Reduced security metric review time by 40%',
    ],
  },
  {
    title: 'Business Management Platform',
    tech: 'React, TypeScript, Supabase',
    description: 'Enterprise Operations System',
    highlights: [
      'Managing 200+ records with data integrity',
      'Created 5+ reporting dashboards improving efficiency by 25%',
      'Real-time database synchronization with 99.9% data consistency',
    ],
  },
  {
    title: 'Competition Management System',
    tech: 'React, Supabase, RBAC',
    description: 'Full-Stack Application',
    highlights: [
      'Role-based access control serving 3 admin roles',
      'Handling 2,000+ registrations with automated workflows',
      'Secure authentication flows protecting participant data',
    ],
  },
];

export default function Resume() {
  return (
    <div className="bg-background min-h-screen">
      {/* Hero / Header */}
      <section className="relative py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-10 left-10 w-80 h-80 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Photo */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="shrink-0"
              >
                <div className="w-44 h-44 md:w-52 md:h-52 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_0_40px_hsl(187_100%_50%/0.15)] hover:border-primary hover:shadow-[0_0_60px_hsl(187_100%_50%/0.25)] transition-all duration-500">
                  <img
                    src={founderImage}
                    alt="Ahmed Tareq"
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.div>

              {/* Info */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="text-center md:text-left flex-1"
              >
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-2 tracking-tight">
                  Ahmed Tareq
                </h1>
                <p className="text-lg md:text-xl text-primary font-semibold mb-1">
                  SOC Analyst & Cybersecurity Professional
                </p>
                <div className="flex items-center gap-2 justify-center md:justify-start mb-4">
                  <div className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20">
                    <span className="text-xs font-bold text-accent flex items-center gap-1">
                      <Trophy className="h-3 w-3" /> Top 4% — TryHackMe (3M+ Users)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start text-sm text-muted-foreground mb-5">
                  <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> +20 155 918 1558</span>
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> ahmed.tareq.alieldin@gmail.com</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Egypt</span>
                </div>

                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {[
                    { icon: Linkedin, href: 'https://www.linkedin.com/in/ah-m-ed-tareq-48069523b/', label: 'LinkedIn' },
                    { icon: Github, href: 'https://github.com/Palestine-1', label: 'GitHub' },
                    { icon: MessageCircle, href: 'https://wa.me/201559181558', label: 'WhatsApp' },
                  ].map(link => (
                    <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-all duration-300"
                      aria-label={link.label}>
                      <link.icon className="h-4 w-4" />
                    </a>
                  ))}
                  <a href="/Ahmed_Tareq_CV.pdf" download
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all duration-300 text-sm font-medium">
                    <Download className="h-4 w-4" /> Download CV
                  </a>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Summary */}
      <section className="py-12 px-6">
        <div className="container mx-auto max-w-5xl">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}
            className="p-6 md:p-8 rounded-2xl bg-card/80 border border-border backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
              <h2 className="text-xl font-bold text-foreground">Professional Summary</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              CCNA-certified SOC Analyst with <span className="text-foreground font-medium">600+ hours</span> of hands-on cybersecurity training in threat detection, incident response, and SIEM operations (FortiSIEM, QRadar). Monitored <span className="text-foreground font-medium">500+ daily security events</span>, reduced incident response time by <span className="text-primary font-semibold">30%</span>, and executed <span className="text-foreground font-medium">15+ Red Team exercises</span>. Ranked in the <span className="text-accent font-semibold">Top 4%</span> out of 3M+ users on TryHackMe. Bachelor's degree in Computer Science from Menoufia University (2025).
            </p>
          </motion.div>
        </div>
      </section>

      {/* Experience */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-5xl">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-10">
            <div className="p-2 rounded-lg bg-primary/10"><Briefcase className="h-5 w-5 text-primary" /></div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Work Experience</h2>
          </motion.div>

          <div className="space-y-6">
            {experiences.map((exp, i) => (
              <motion.div key={exp.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative pl-6 border-l-2 border-primary/30 hover:border-primary/60 transition-colors group"
              >
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary group-hover:bg-primary/40 transition-colors" />
                <div className="p-5 md:p-6 rounded-2xl bg-card border border-border group-hover:border-primary/30 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                    <h3 className="text-lg font-bold text-foreground">{exp.title}</h3>
                    <span className="text-xs px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium w-fit">{exp.duration}</span>
                  </div>
                  <p className="text-sm text-primary font-medium mb-1">{exp.company}</p>
                  <p className="text-xs text-muted-foreground mb-4">{exp.period}</p>
                  <ul className="space-y-2">
                    {exp.highlights.map((h, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/50" />
        <div className="container mx-auto px-6 relative max-w-5xl">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-10">
            <div className="p-2 rounded-lg bg-primary/10"><Cpu className="h-5 w-5 text-primary" /></div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Technical Skills</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill, i) => (
              <motion.div key={skill.category}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <skill.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{skill.category}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skill.items.map(item => (
                    <span key={item} className="text-xs px-2.5 py-1 rounded-full bg-secondary border border-border text-muted-foreground">
                      {item}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-5xl">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-10">
            <div className="p-2 rounded-lg bg-primary/10"><Code className="h-5 w-5 text-primary" /></div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Featured Projects</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {projects.map((project, i) => (
              <motion.div key={project.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all group flex flex-col"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-bold text-foreground">{project.title}</h3>
                </div>
                <p className="text-xs text-primary font-medium mb-1">{project.description}</p>
                <p className="text-[11px] text-muted-foreground mb-3">{project.tech}</p>
                <ul className="space-y-1.5 flex-1">
                  {project.highlights.map((h, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-accent shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-card/50" />
        <div className="container mx-auto px-6 relative max-w-5xl">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-10">
            <div className="p-2 rounded-lg bg-primary/10"><Award className="h-5 w-5 text-primary" /></div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Certifications & Training</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {certifications.map((cert, i) => (
              <motion.div key={cert.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className={`p-4 rounded-xl border transition-all ${
                  cert.highlight 
                    ? 'bg-primary/5 border-primary/20 hover:border-primary/40' 
                    : 'bg-card border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{cert.name}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{cert.issuer}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium ${
                    cert.status === 'In Progress' 
                      ? 'bg-accent/10 text-accent border border-accent/20' 
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {cert.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Education */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-5xl">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }} className="flex items-center gap-3 mb-10">
            <div className="p-2 rounded-lg bg-primary/10"><GraduationCap className="h-5 w-5 text-primary" /></div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Education</h2>
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all">
            <h3 className="text-lg font-bold text-foreground mb-1">Bachelor of Computer Science</h3>
            <p className="text-primary font-medium text-sm mb-1">Faculty of Computers and Information, Menoufia University</p>
            <p className="text-xs text-muted-foreground mb-3">Graduated May 2025 — Egypt</p>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Globe className="h-3 w-3" /> Arabic (Native) • English (B2 Upper Intermediate)
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-3xl text-center">
          <motion.div {...fadeUp} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">Let's Work Together</h2>
            <p className="text-muted-foreground mb-6">Interested in cybersecurity collaboration or have a project in mind?</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="mailto:ahmed.tareq.alieldin@gmail.com"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
                <Mail className="h-4 w-4" /> Get in Touch
              </a>
              <a href="/Ahmed_Tareq_CV.pdf" download
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-border text-foreground font-medium hover:border-primary/40 transition-colors">
                <Download className="h-4 w-4" /> Download Full CV
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
