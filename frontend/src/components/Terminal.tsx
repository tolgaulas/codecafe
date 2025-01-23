import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { FitAddon } from "xterm-addon-fit";

const TerminalComponent = forwardRef((_, ref) => {
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

  useImperativeHandle(ref, () => ({
    writeToTerminal: (output: string) => {
      if (terminalInstance.current) {
        const term = terminalInstance.current;
        term.write("\x1b[2K\r");

        const lines = output.split("\n");
        lines.forEach((line, index) => {
          if (index > 0) {
            term.write("\r\n");
          }
          term.write(line);
        });

        if (!output.endsWith("\n")) {
          term.write("\r\n");
        }
        term.write("$ ");
      }
    },
  }));

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
});

export default TerminalComponent;
