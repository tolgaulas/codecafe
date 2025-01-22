import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { FitAddon } from "xterm-addon-fit";

interface TerminalComponentProps {
  output?: string;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({ output }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);

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

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (terminalRef.current) {
      term.open(terminalRef.current);
      fitAddon.fit();
    }

    terminalInstance.current = term;
    term.write("Welcome to CodeCafe!\r\n$ ");

    return () => term.dispose();
  }, []);

  // Effect to handle new output
  useEffect(() => {
    if (output && terminalInstance.current) {
      const term = terminalInstance.current;

      // Clear the current line (where the prompt is)
      term.write("\x1b[2K\r");

      // Split the output into lines and handle each line properly
      const lines = output.split("\n");
      lines.forEach((line, index) => {
        if (index > 0) {
          term.write("\r\n");
        }
        term.write(line);
      });

      // Only add a newline if the output doesn't end with one
      if (!output.endsWith("\n")) {
        term.write("\r\n");
      }
      term.write("$ ");
    }
  }, [output]);

  return (
    <div
      ref={terminalRef}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#1e1e1e",
      }}
    />
  );
};

export default TerminalComponent;
