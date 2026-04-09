"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const COMPANIES = ["Google", "Meta", "Amazon", "Apple", "Microsoft", "Shopify", "Uber", "Airbnb", "Netflix", "Stripe"];
const ROADMAPS = [
  { value: "neetcode150", label: "NeetCode 150" },
  { value: "blind75", label: "Blind 75" },
  { value: "grind169", label: "Grind 169" },
  { value: "none", label: "None" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [cookie, setCookie] = useState("");
  // Step 2
  const [ghToken, setGhToken] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  // Step 3
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [roadmap, setRoadmap] = useState("none");
  const [interviewDate, setInterviewDate] = useState("");

  function toggleCompany(company: string) {
    setSelectedCompanies((prev) =>
      prev.includes(company) ? prev.filter((c) => c !== company) : [...prev, company]
    );
  }

  async function submitStep1() {
    setError("");
    setLoading(true);
    try {
      await api.post("/users/me/leetcode", { session_cookie: cookie });
      setStep(2);
    } catch {
      setError("Failed to save LeetCode cookie. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitStep2() {
    setError("");
    setLoading(true);
    try {
      await api.post("/users/me/github", { token: ghToken, repo: ghRepo });
      setStep(3);
    } catch {
      setError("Failed to save GitHub credentials. Check your token and repo format (owner/repo).");
    } finally {
      setLoading(false);
    }
  }

  async function submitStep3() {
    setError("");
    setLoading(true);
    try {
      await api.patch("/users/me", {
        target_companies: selectedCompanies.map((c) => c.toLowerCase()),
        active_roadmap: roadmap,
        interview_date: interviewDate || null,
      });
      router.push("/dashboard");
    } catch {
      setError("Failed to save preferences.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : s < step ? "w-4 bg-primary/50" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Connect LeetCode</CardTitle>
              <CardDescription>
                Grindstone needs your LeetCode session cookie to sync your submissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="rounded-md bg-muted p-4 text-sm space-y-1">
                <p className="font-medium">How to get your session cookie:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Open <strong>leetcode.com</strong> and sign in</li>
                  <li>Open DevTools (<kbd>F12</kbd> or <kbd>Cmd+Opt+I</kbd>)</li>
                  <li>Go to <strong>Application → Cookies → leetcode.com</strong></li>
                  <li>Copy the value of <strong>LEETCODE_SESSION</strong></li>
                </ol>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cookie">LEETCODE_SESSION cookie</Label>
                <Input
                  id="cookie"
                  type="password"
                  placeholder="Paste your cookie here"
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}>Skip</Button>
              <Button onClick={submitStep1} disabled={!cookie || loading}>
                {loading ? "Saving..." : "Connect →"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Connect GitHub</CardTitle>
              <CardDescription>
                Auto-commit accepted solutions to your GitHub repo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="space-y-2">
                <Label htmlFor="token">Personal Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="ghp_..."
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Needs <strong>repo</strong> scope. Create one at github.com/settings/tokens.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="repo">Target repository</Label>
                <Input
                  id="repo"
                  placeholder="username/leetcode-solutions"
                  value={ghRepo}
                  onChange={(e) => setGhRepo(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}>Skip</Button>
              <Button onClick={submitStep2} disabled={!ghToken || !ghRepo || loading}>
                {loading ? "Saving..." : "Connect →"}
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Set your goals</CardTitle>
              <CardDescription>Grindstone uses these to personalise recommendations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="space-y-2">
                <Label>Target companies</Label>
                <div className="flex flex-wrap gap-2">
                  {COMPANIES.map((company) => (
                    <button
                      key={company}
                      type="button"
                      onClick={() => toggleCompany(company)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        selectedCompanies.includes(company)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-accent"
                      }`}
                    >
                      {company}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Roadmap</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ROADMAPS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRoadmap(r.value)}
                      className={`px-3 py-2 rounded-md text-sm border transition-colors text-left ${
                        roadmap === r.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-accent"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interview-date">Interview date (optional)</Label>
                <Input
                  id="interview-date"
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>Skip</Button>
              <Button onClick={submitStep3} disabled={loading}>
                {loading ? "Saving..." : "Start grinding →"}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
