// Terminal.tsx
import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

const TerminalComponent: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: false,
      fontSize: 14,
      fontFamily: "monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#ffffff",
      },
    });

    if (terminalRef.current) {
      term.open(terminalRef.current);
    }

    // Display a welcome message and the prompt
    term.write("Welcome to CodeCafe!\r\n$ ");

    term.onData((data) => {
      if (data === "\r") {
        term.write("\r\n$ "); // On Enter, add a new line and prompt
      } else if (data === "\u007f") {
        // Handle backspace
        term.write("\b \b");
      } else {
        term.write(data); // Display typed character
      }
    });

    return () => term.dispose(); // Clean up terminal instance on unmount
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{
        width: "100%",
        height: "100vh", // Full viewport height
        backgroundColor: "#1e1e1e", // Match terminal theme
      }}
    />
  );
};

export default TerminalComponent;
