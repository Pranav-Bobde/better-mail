'use client';

import { Button } from '@code-main/ui/components/button';
import { Mail, MessageSquare, Zap, ArrowRight, Check } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-900 bg-black/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-6 h-6" />
            <span className="font-semibold text-lg">better-mail</span>
          </div>
          <div className="flex items-center gap-6">
            <Button variant="ghost" className="text-zinc-400 hover:text-white">Features</Button>
            <Button variant="ghost" className="text-zinc-400 hover:text-white">Pricing</Button>
            <Button className="bg-white text-black hover:bg-zinc-100">Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-7xl font-bold leading-tight">
              Email made <span className="text-zinc-400">intelligent</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
              A modern mail client powered by AI. Compose faster, find anything instantly, and let AI handle the rest.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="bg-white text-black hover:bg-zinc-100 h-12 px-8 text-base">
              Start Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-900 h-12 px-8 text-base">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Preview */}
      <section className="relative px-6 mb-20">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
            {/* Gradient blur background */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/50 to-transparent pointer-events-none" />
            
            {/* Simplified preview mockup */}
            <div className="relative p-8 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 rounded bg-zinc-800" />
                  <div className="h-2 w-32 rounded bg-zinc-900" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-zinc-900" />
                <div className="h-3 w-full rounded bg-zinc-900" />
                <div className="h-3 w-2/3 rounded bg-zinc-900" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Why better-mail?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
              <Zap className="w-8 h-8 mb-4 text-white" />
              <h3 className="font-semibold text-lg mb-2">AI-Powered Compose</h3>
              <p className="text-zinc-400 text-sm">Write better emails faster with AI suggestions and completions.</p>
            </div>

            {/* Feature 2 */}
            <div className="border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
              <MessageSquare className="w-8 h-8 mb-4 text-white" />
              <h3 className="font-semibold text-lg mb-2">Instant Search</h3>
              <p className="text-zinc-400 text-sm">Find any email in milliseconds. Powered by intelligent indexing.</p>
            </div>

            {/* Feature 3 */}
            <div className="border border-zinc-800 rounded-lg p-6 hover:border-zinc-700 transition-colors">
              <Mail className="w-8 h-8 mb-4 text-white" />
              <h3 className="font-semibold text-lg mb-2">Clean Inbox</h3>
              <p className="text-zinc-400 text-sm">Auto-organize, smart filtering, and one-click unsubscribe.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Simple Pricing</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Starter */}
            <div className="border border-zinc-800 rounded-lg p-8">
              <h3 className="font-semibold text-xl mb-2">Starter</h3>
              <p className="text-zinc-400 text-sm mb-6">Perfect for personal use</p>
              <div className="text-4xl font-bold mb-8">Free</div>
              <ul className="space-y-3 mb-8">
                {['Unlimited emails', 'Basic AI features', 'Smart search'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full border-zinc-700 text-white hover:bg-zinc-900">
                Get Started
              </Button>
            </div>

            {/* Pro */}
            <div className="border border-white rounded-lg p-8 bg-zinc-950">
              <h3 className="font-semibold text-xl mb-2">Pro</h3>
              <p className="text-zinc-400 text-sm mb-6">For power users</p>
              <div className="text-4xl font-bold mb-8">$19<span className="text-lg text-zinc-400">/mo</span></div>
              <ul className="space-y-3 mb-8">
                {['Everything in Starter', 'Advanced AI features', 'Priority support', 'Custom workflows'].map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className="w-full bg-white text-black hover:bg-zinc-100">
                Start Free Trial
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <h2 className="text-5xl font-bold">Ready to transform your email?</h2>
          <p className="text-xl text-zinc-400">Join thousands of users who already love better-mail.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-black hover:bg-zinc-100 h-12 px-8 text-base">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-zinc-700 text-white hover:bg-zinc-900 h-12 px-8 text-base">
              View Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Mail className="w-5 h-5" />
                <span className="font-semibold">better-mail</span>
              </div>
              <p className="text-sm text-zinc-400">Modern email, powered by AI.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-zinc-400">
            <p>&copy; 2024 better-mail. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white">Twitter</a>
              <a href="#" className="hover:text-white">GitHub</a>
              <a href="#" className="hover:text-white">Discord</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
