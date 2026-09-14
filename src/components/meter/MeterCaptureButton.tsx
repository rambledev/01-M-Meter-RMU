interface MeterCaptureButtonProps {
  onCapture: () => void;
}

export default function MeterCaptureButton({
  onCapture,
}: MeterCaptureButtonProps) {
  return (
    <button
      type="button"
      onClick={onCapture}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-6 py-3 font-bold text-black shadow"
    >
      ถ่าย
    </button>
  );
}
