import { useWrapped, WrappedScope } from './WrappedContext';

interface Props {
  scope: WrappedScope;
  label?: string;
  className?: string;
}

const WrappedLauncherButton = ({ scope, label = 'Weekly Wrapped', className }: Props) => {
  const { open } = useWrapped();
  return (
    <button
      type="button"
      className={`wrapped-launcher ${className ?? ''}`}
      onClick={() => open(scope)}
    >
      <span className="dot" />
      {label}
    </button>
  );
};

export default WrappedLauncherButton;