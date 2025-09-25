// app/auth/sign-up/SignUpClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AuthLayout from "../layout";

export default function SignUpClient() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+61");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      newErrors.email = "Enter a valid email";
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword)
      newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("password")) {
        setErrors({ password: error.message });
      } else if (error.message.toLowerCase().includes("email")) {
        setErrors({ email: error.message });
      } else {
        setErrors({ general: error.message });
      }
      setLoading(false);
      return;
    }

    if (!data.session) {
      setLoading(false);
      setErrors({
        general: "Please check your email to confirm your account before signing in.",
      });
      return;
    }

    const userId = data.user?.id;

    if (userId) {
      const { error: insertError } = await supabase
        .from("user_profile")
        .upsert({
          user_id: userId,
          full_name: name,
          phone: `${countryCode}${phone}`,
          email,
        })
        .select();

      if (insertError) {
        setErrors({
          general: "Account created, but failed to save profile.",
        });
        setLoading(false);
        return;
      }
    }

    router.push("/staff/run");
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-white">Create your staff account</h2>
          <p className="text-sm text-white/60">Tell us a little about you to get started with BinBird.</p>
        </div>
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          {/* Full Name */}
          <div>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: "" }));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
              autoComplete="name"
              required
            />
            {errors.name && <p className="mt-1 text-sm text-red-200">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((prev) => ({ ...prev, email: "" }));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
              autoComplete="email"
              required
            />
            {errors.email && <p className="mt-1 text-sm text-red-200">{errors.email}</p>}
          </div>

          {/* Phone with country code */}
          <div>
            <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/5">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-black/40 px-3 py-3 text-sm text-white focus:outline-none"
              >
                <option value="+61">🇦🇺 +61</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
                <option value="+64">🇳🇿 +64</option>
                <option value="+91">🇮🇳 +91</option>
              </select>
              <input
                type="tel"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setErrors((prev) => ({ ...prev, phone: "" }));
                }}
                className="w-full bg-transparent px-4 py-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
                autoComplete="tel"
                required
              />
            </div>
            {errors.phone && <p className="mt-1 text-sm text-red-200">{errors.phone}</p>}
          </div>

          {/* Password */}
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
              autoComplete="new-password"
              required
            />
            {errors.password && <p className="mt-1 text-sm text-red-200">{errors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/50 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
              autoComplete="new-password"
              required
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-200">{errors.confirmPassword}</p>
            )}
          </div>

          {/* General error */}
          {errors.general && (
            <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">{errors.general}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-binbird-red py-3 font-semibold text-white shadow-lg shadow-binbird-red/30 transition hover:bg-[#ff6c6c] focus:outline-none focus:ring-2 focus:ring-binbird-red/50 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Sign Up"}
          </button>

          <p className="mt-2 flex justify-center text-sm text-white/60">
            <span>Already have an account?</span>
            <button
              type="button"
              onClick={() => router.push("/auth/sign-in")}
              className="ml-2 font-medium text-binbird-red hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
