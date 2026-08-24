export function SpellcheckFlags({ flags, validatedAt }: {
  flags: Record<string, unknown>[];
  validatedAt: string | null;
}) {
  if (!validatedAt) {
    return <p className="mt-3 text-xs text-amber-300">Chưa chạy kiểm tra kỹ thuật Khmer.</p>;
  }
  if (flags.length === 0) {
    return <p className="mt-3 text-xs text-emerald-300/70">Không có cảnh báo kỹ thuật.</p>;
  }
  return (
    <details className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
      <summary className="cursor-pointer text-xs font-medium text-amber-200">
        {flags.length} từ/ký tự cần kiểm tra
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-katha-text/55">
        {flags.map((flag, index) => (
          <li key={`${String(flag.kind)}-${String(flag.start)}-${index}`}>
            {String(flag.kind)} · vị trí {String(flag.start)}–{String(flag.end)}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-katha-text/35">Cảnh báo hỗ trợ review, không phải kết luận sai chính tả/ngữ pháp.</p>
    </details>
  );
}