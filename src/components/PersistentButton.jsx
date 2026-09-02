// Persistent Button Component
const PersistentButton = ({ currentCard, onAction, className = '' }) => {
  const getButtonContent = () => {
    switch (currentCard?.type) {
      case 'settings':
        return {
          text: 'More Settings',
          action: () => onAction('more-settings'),
          variant: 'dropdown',
        };
      case 'create':
        return {
          text: 'Add Avatar',
          action: () => onAction('add-avatar'),
          variant: 'primary',
        };
      default:
        return {
          text: 'Avatar Settings',
          action: () => onAction('avatar-settings'),
          variant: 'default',
        };
    }
  };

  const buttonConfig = getButtonContent();

  return (
    <div className={`flex justify-center ${className}`}>
      <button
        onClick={buttonConfig.action}
        className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-105 ${
          buttonConfig.variant === 'primary'
            ? 'bg-white text-black hover:bg-white/90'
            : buttonConfig.variant === 'dropdown'
            ? 'bg-black/20 backdrop-blur-sm border border-white/10 text-neutral-200 hover:bg-white/10'
            : 'bg-black/30 backdrop-blur-sm border border-white/30 text-neutral-200 hover:bg-white/10'
        }`}
      >
        {buttonConfig.text}
      </button>
    </div>
  );
};

export default PersistentButton;
