import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { FitAddon } from "xterm-addon-fit";

const TerminalComponent = forwardRef((_, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "monospace",
      theme: {
        background: "rgba(0,0,0,0)",
        foreground: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    if (terminalRef.current) {
      term.open(terminalRef.current);

      // Create a ResizeObserver to handle container resize
      const resizeObserver = new ResizeObserver((entries) => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
          } catch (error) {
            console.error("Terminal resize error:", error);
          }
        });
      });

      // Observe the parent container
      if (terminalRef.current.parentElement) {
        resizeObserver.observe(terminalRef.current.parentElement);
      }

      // Initial fit
      fitAddon.fit();

      // Store references
      terminalInstance.current = term;
      fitAddonRef.current = fitAddon;
      resizeObserverRef.current = resizeObserver;

      term.write("Welcome to CodeCafe!\r\n$ ");
    }

    // Cleanup function
    return () => {
      term.dispose();
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
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
        backgroundColor: "rgba(0,0,0,0)",
      }}
      className="overflow-hidden"
    />
  );
});

export default TerminalComponent;
