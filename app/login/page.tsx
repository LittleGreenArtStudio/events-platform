import { signIn } from "./actions"

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-serif text-stone-800 tracking-wide italic">
            Forager Crafts
          </h1>
          <p className="mt-2 text-stone-400 text-sm tracking-wide">
            Sign in to continue
          </p>
        </div>

        <form
          action={signIn}
          className="bg-white rounded-2xl shadow-sm border border-stone-100 px-8 py-9 space-y-5"
        >
          {searchParams.error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {searchParams.error}
            </p>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-stone-400 uppercase tracking-widest"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition text-sm"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-stone-400 uppercase tracking-widest"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3 px-4 bg-stone-800 hover:bg-stone-700 active:bg-stone-900 text-white rounded-lg text-sm font-medium tracking-wide transition"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  )
}
