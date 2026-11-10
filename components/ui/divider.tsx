export default function Divider() {
  return (
    <div className="flex items-center gap-4 my-3">
      <div className="flex-1 h-px bg-gray-300" />

      <span className="text-xs text-gray-400">
        Or
      </span>

      <div className="flex-1 h-px bg-gray-300" />
    </div>
  );
}