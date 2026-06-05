type LoadingLabelProps = {
  text: string;
};

export default function LoadingLabel({ text }: LoadingLabelProps) {
  return (
    <>
      {text}
      <span className="loading-wave-dots" aria-hidden="true">
        <span className="loading-wave-dot">.</span>
        <span className="loading-wave-dot">.</span>
        <span className="loading-wave-dot">.</span>
      </span>
    </>
  );
}
