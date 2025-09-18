// app/auth/sign-up/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AuthLayout from "../layout";

export const metadata = {
  title: "Create Your BinBird Account",
};

export default function SignUpPage() {
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
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) newErrors.email = "Enter a valid email";
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setErrors({ email: error.message });
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      const { error: insertError } = await supabase.from("user_profile").insert({
        id: userId,
        name,
        phone: `${countryCode}${phone}`,
        email,
      });
      if (insertError) {
        console.error("Profile insert error:", insertError.message);
        setErrors({ general: "Account created, but failed to save profile." });
      }
    }

    setLoading(false);
    router.push("/staff/run");
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl sm:text-[26px] font-bold text-center mb-6 text-[#ff5757]">
        Create Your BinBird Account
      </h1>
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
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#ff5757]"
            autoComplete="name"
            required
          />
          {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
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
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#ff5757]"
            autoComplete="email"
            required
          />
          {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
        </div>

        {/* Phone with country code */}
        <div>
          <div className="flex">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="px-3 rounded-l-lg border border-r-0 bg-gray-100 text-gray-600 text-sm focus:outline-none"
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
              className="w-full px-4 py-2 border rounded-r-lg focus:ring-2 focus:ring-[#ff5757]"
              autoComplete="tel"
              required
            />
          </div>
          {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
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
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#ff5757]"
            autoComplete="new-password"
            required
          />
          {errors.password && <p className="text-sm text-red-600 mt-1">{errors.password}</p>}
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
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#ff5757]"
            autoComplete="new-password"
            required
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-600 mt-1">{errors.confirmPassword}</p>
          )}
        </div>

        {/* General error */}
        {errors.general && <p className="text-sm text-red-600">{errors.general}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#ff5757] text-white font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Creating Account…" : "Sign Up"}
        </button>

        <p className="text-sm text-center mt-4">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/auth")}
            className="text-[#ff5757] hover:underline"
          >
            Sign In
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}
