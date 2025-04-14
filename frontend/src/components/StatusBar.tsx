import { ConnectionStatus, StatusBarProps } from "../types/props";

const StatusBar: React.FC<StatusBarProps> = ({
  connectionStatus,
  language = "plaintext",
  line = 1, // Default line
  column = 1, // Default column
}: StatusBarProps) => {
  // function to determine status indicator style
  const getStatusIndicator = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return (
          <span
            className="w-2 h-2 bg-green-500 rounded-full inline-block mr-1.5"
            title="Connected"
          ></span>
        );
      case "disconnected":
        return (
          <span
            className="w-2 h-2 bg-red-500 rounded-full inline-block mr-1.5"
            title="Disconnected"
          ></span>
        );
      case "connecting":
        return (
          <span
            className="w-2 h-2 bg-yellow-500 rounded-full inline-block mr-1.5 animate-pulse"
            title="Connecting..."
          ></span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-stone-800 bg-opacity-80 text-stone-500 flex justify-between items-center px-4 py-1 text-xs border-t border-stone-600 flex-shrink-0">
      <div className="flex items-center space-x-4">
        {/* Connection Status Indicator */}
        {connectionStatus && (
          <span className="flex items-center">
            {getStatusIndicator(connectionStatus)}
            {connectionStatus.charAt(0).toUpperCase() +
              connectionStatus.slice(1)}
          </span>
        )}
        <span>{language}</span>
        <span>UTF-8</span>
      </div>
      <div className="flex items-center space-x-4">
        <span>
          Ln {line}, Col {column}
        </span>
        <span>Spaces: 2</span> {/* TODO: Make spaces dynamic? */}
      </div>
    </div>
  );
};

export default StatusBar;
