type HowToPlayDialogProps = {
  title: string;
  subtitle: string;
  steps: string[];
  buttonClassName?: string;
  onClose: () => void;
};

export default function HowToPlayDialog({
  title,
  subtitle,
  steps,
  buttonClassName = "guess-submit-btn",
  onClose,
}: HowToPlayDialogProps) {
  return (
    <div className="result-modal-backdrop" onClick={onClose}>
      <section
        className="result-modal-panel how-to-play-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="result-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close how to play dialog"
        >
          ×
        </button>
        <h2 className="result-modal-title how-to-play-title" id="how-to-play-title">
          {title}
        </h2>
        <p className="how-to-play-subtitle">{subtitle}</p>
        <ul className="how-to-play-list">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <button className={buttonClassName} type="button" onClick={onClose}>
          Got it
        </button>
      </section>
    </div>
  );
}
