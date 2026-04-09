"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/auth";
import api from "@/lib/api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const COMPANIES = ["Google", "Meta", "Amazon", "Apple", "Microsoft", "Shopify", "Uber", "Airbnb", "Netflix", "Stripe"];
const ROADMAPS = [
  { value: "neetcode150", label: "NeetCode 150" },
  { value: "blind75", label: "Blind 75" },
  { value: "grind169", label: "Grind 169" },
  { value: "none", label: "None" },
];

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // LeetCode form
  const [cookie, setCookie] = useState("");
  const [lcLoading, setLcLoading] = useState(false);
  const [lcMsg, setLcMsg] = useState("");

  // GitHub form
  const [ghToken, setGhToken] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghLoading, setGhLoading] = useState(false);
  const [ghMsg, setGhMsg] = useState("");

  // Preferences form
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [roadmap, setRoadmap] = useState("none");
  const [interviewDate, setInterviewDate] = useState("");
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  useEffect(() => {
    getMe().then((u) => {
      setUser(u);
      setSelectedCompanies(u.target_companies?.map((c) => c.charAt(0).toUpperCase() + c.slice(1)) ?? []);
      setRoadmap(u.active_roadmap ?? "none");
      setLoading(false);
    });
  }, []);

  function toggleCompany(company: string) {
    setSelectedCompanies((prev) =>
      prev.includes(company) ? prev.filter((c) => c !== company) : [...prev, company]
    );
  }

  async function saveLeetCode() {
    setLcLoading(true);
    setLcMsg("");
    try {
      await api.post("/users/me/leetcode", { session_cookie: cookie });
      setCookie("");
      setLcMsg("Connected successfully.");
      const u = await getMe();
      setUser(u);
    } catch {
      setLcMsg("Failed to connect. Check your cookie.");
    } finally {
      setLcLoading(false);
    }
  }

  async function disconnectLeetCode() {
    setLcLoading(true);
    try {
      await api.delete("/users/me/leetcode");
      const u = await getMe();
      setUser(u);
    } finally {
      setLcLoading(false);
    }
  }

  async function saveGitHub() {
    setGhLoading(true);
    setGhMsg("");
    try {
      await api.post("/users/me/github", { token: ghToken, repo: ghRepo });
      setGhToken("");
      setGhMsg("Connected successfully.");
      const u = await getMe();
      setUser(u);
    } catch {
      setGhMsg("Failed to connect. Check token and repo format.");
    } finally {
      setGhLoading(false);
    }
  }

  async function disconnectGitHub() {
    setGhLoading(true);
    try {
      await api.delete("/users/me/github");
      const u = await getMe();
      setUser(u);
    } finally {
      setGhLoading(false);
    }
  }

  async function savePreferences() {
    setPrefLoading(true);
    setPrefMsg("");
    try {
      await api.patch("/users/me", {
        target_companies: selectedCompanies.map((c) => c.toLowerCase()),
        active_roadmap: roadmap,
        interview_date: interviewDate || null,
      });
      setPrefMsg("Saved.");
    } catch {
      setPrefMsg("Failed to save preferences.");
    } finally {
      setPrefLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  const lcExpired = user?.lc_session_expires_at && new Date(user.lc_session_expires_at) < new Date();

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* LeetCode */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>LeetCode</CardTitle>
            {user?.lc_session_expires_at === null && !lcExpired ? (
              <Badge variant="secondary">Connected</Badge>
            ) : lcExpired ? (
              <Badge variant="destructive">Cookie expired</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <CardDescription>
            {lcExpired
              ? "Your session cookie has expired. Reconnect to resume syncing."
              : "Paste your LEETCODE_SESSION cookie to enable syncing."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lcMsg && <p className="text-sm text-muted-foreground">{lcMsg}</p>}
          <div className="space-y-2">
            <Label htmlFor="lc-cookie">New session cookie</Label>
            <Input
              id="lc-cookie"
              type="password"
              placeholder="LEETCODE_SESSION value"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveLeetCode} disabled={!cookie || lcLoading} size="sm">
              {lcLoading ? "Saving..." : "Connect"}
            </Button>
            {user?.lc_session_expires_at !== undefined && (
              <Button variant="outline" size="sm" onClick={disconnectLeetCode} disabled={lcLoading}>
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* GitHub */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>GitHub</CardTitle>
            {user?.github_repo ? (
              <Badge variant="secondary">{user.github_repo}</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <CardDescription>Auto-commit accepted solutions to a GitHub repo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ghMsg && <p className="text-sm text-muted-foreground">{ghMsg}</p>}
          <div className="space-y-2">
            <Label htmlFor="gh-token">Personal Access Token</Label>
            <Input
              id="gh-token"
              type="password"
              placeholder="ghp_..."
              value={ghToken}
              onChange={(e) => setGhToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gh-repo">Repository</Label>
            <Input
              id="gh-repo"
              placeholder="username/repo"
              value={ghRepo}
              onChange={(e) => setGhRepo(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveGitHub} disabled={!ghToken || !ghRepo || ghLoading} size="sm">
              {ghLoading ? "Saving..." : "Connect"}
            </Button>
            {user?.github_repo && (
              <Button variant="outline" size="sm" onClick={disconnectGitHub} disabled={ghLoading}>
                Disconnect
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Personalise your recommendations and roadmap.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {prefMsg && <p className="text-sm text-muted-foreground">{prefMsg}</p>}
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
          <Button onClick={savePreferences} disabled={prefLoading}>
            {prefLoading ? "Saving..." : "Save preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
