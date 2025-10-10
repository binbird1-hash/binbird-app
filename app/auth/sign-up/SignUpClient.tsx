"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useSupabase } from "@/components/providers/SupabaseProvider";

type AccountRole = "staff" | "client";

export default function SignUpClient() {
  const router = useRouter();
  const supabase = useSupabase();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+61");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("client");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function validate() {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = "Enter a valid email";
    }
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
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
        data: {
          full_name: name,
          phone: `${countryCode}${phone}`,
          role,
        },
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
        general:
          "Please check your email to confirm your account before signing in.",
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
          role,
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

    const destination = role === "staff" ? "/staff/run" : "/client/dashboard";
    router.push(destination);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-white">
          Create your BinBird account
        </h2>
        <p className="text-sm text-white/60">
          Choose the experience you need and tell us a little about yourself to
          get started.
        </p>
      </div>
      <form onSubmit={handleSignUp} className="flex flex-col gap-4">
        <div>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: "" }));
            }}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/40"
            autoComplete="name"
            required
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-200">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2 text-sm font-medium text-white/80">
          <label className="sr-only" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            placeholder="Email"
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((prev) => ({ ...prev, email: "" }));
            }}
            className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-binbird-red focus:outline-none focus:ring-2 focus:ring-binbird-red/30"
            autoComplete="email"
            required
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-200">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2 text-sm font-medium text-white/80">
          <label className="sr-only" htmlFor="signup-phone">
            Phone Number
          </label>
          <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/10 focus-within:border-binbird-red focus-within:ring-2 focus-within:ring-binbird-red/30">
            <select
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              className="bg-black/40 px-3 py-3 text-sm text-white outline-none focus:outline-none"
            >
              <option value="+61">🇦🇺 +61</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
              <option value="+64">🇳🇿 +64</option>
              <option value="+91">🇮🇳 +91</option>
            </select>
            <input
              id="signup-phone"
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setErrors((prev) => ({ ...prev, phone: "" }));
              }}
              className="flex-1 bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
              autoComplete="tel"
              required
            />
          </div>
          {errors.phone && (
            <p className="mt-1 text-sm text-red-200">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-2 text-sm font-medium text-white/80">
          <span>Account type</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                role === "client"
                  ? "border-binbird-red bg-binbird-red/10"
                  : "border-white/10 bg-white/10 hover:border-binbird-red/50"
              }`}
            >
              <input
                type="radio"
                name="account-role"
                value="client"
                checked={role === "client"}
                onChange={() => setRole("client")}
                className="h-4 w-4 text-binbird-red focus:ring-binbird-red"
              />
              <div>
                <p className="text-sm font-semibold text-white">
                  Client account
                </p>
                <p className="text-xs text-white/60">
                  Access invoices, proofs, and service updates.
                </p>
              </div>
            </label>
            <label
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                role === "staff"
                  ? "border-binbird-red bg-binbird-red/10"
                  : "border-white/10 bg-white/10 hover:border-binbird-red/50"
              }`}
            >
              <input
                type="radio"
                name="account-role"
                value="staff"
                checked={role === "staff"}
                onChange={() => setRole("staff")}
                className="h-4 w-4 text-binbird-red focus:ring-binbird-red"
              />
              <div>
                <p className="text-sm font-semibold text-white">
                  Staff account
                </p>
                <p className="text-xs text-white/60">
                  Plan routes, capture proof, and manage runs.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="space-y-2 text-sm font-medium text-white/80">
          <label className="sr-only" htmlFor="signup-password">
            Password
          </label>
          <div className="flex items-center rounded-xl border border-white/10 bg-white/10 focus-within:border-binbird-red focus-within:ring-2 focus-within:ring-binbird-red/30">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="Password"
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((prev) => ({ ...prev, password: "" }));
              }}
              className="flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="mr-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={
                showPassword ? "Hide password" : "Toggle password visibility"
              }
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-200">{errors.password}</p>
          )}
        </div>

        <div className="space-y-2 text-sm font-medium text-white/80">
          <label className="sr-only" htmlFor="signup-confirm-password">
            Confirm Password
          </label>
          <div className="flex items-center rounded-xl border border-white/10 bg-white/10 focus-within:border-binbird-red focus-within:ring-2 focus-within:ring-binbird-red/30">
            <input
              id="signup-confirm-password"
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              placeholder="Confirm Password"
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              className="flex-1 rounded-xl bg-transparent px-4 py-3 text-base text-white placeholder:text-white/40 focus:outline-none"
              autoComplete="new-password"
              required
            />
            <button
              type="button"
              className="mr-3 rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={
                showConfirmPassword
                  ? "Hide password"
                  : "Toggle password visibility"
              }
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5" />
              ) : (
                <EyeIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-200">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {errors.general && (
          <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {errors.general}
          </p>
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
            onClick={() => router.push("/auth/login")}
            className="ml-2 font-medium text-binbird-red hover:underline"
          >
            Sign In
          </button>
        </p>
      </form>
    </div>
  );
}
