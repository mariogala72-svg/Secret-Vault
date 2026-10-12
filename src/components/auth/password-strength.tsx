export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z\d]/.test(pw)) pool += 33;
  const bits = pw.length * Math.log2(Math.max(pool, 1));
  const penalty = /(.)\1{2,}/.test(pw) || /^(password|qwerty|123456|secret)/i.test(pw) ? 20 : 0;
  const b = bits - penalty;
  return b < 35 ? 1 : b < 55 ? 2 : b < 75 ? 3 : 4;
}

const labels = ["", "Debole", "Discreta", "Buona", "Ottima"];
const colors = ["bg-line", "bg-danger", "bg-warning", "bg-accent", "bg-success"];

export function PasswordStrength({ password }: { password: string }) {
  const s = scorePassword(password);
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= s ? colors[s] : "bg-line"}`} />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-muted">{labels[s]}</span>
    </div>
  );
}
