import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";
import { FitAddon } from "xterm-addon-fit";

const TerminalComponent = forwardRef((_, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const currentLineRef = useRef<string>("");

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
      const resizeObserver = new ResizeObserver(() => {
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

      // Handle user input - simple approach
      term.onData((data) => {
        // Handle Enter key
        if (data === "\r") {
          const command = currentLineRef.current;
          currentLineRef.current = "";

          term.write("\r\n");

          // Process command (simple example)
          if (command === "clear") {
            term.clear();
          } else if (command === "help") {
            term.write("Available commands: clear, help, echo, date\r\n");
          } else if (command.startsWith("echo ")) {
            term.write(command.substring(5) + "\r\n");
          } else if (command === "date") {
            term.write(new Date().toLocaleString() + "\r\n");
          } else if (command === "codecafe") {
            term.write("\r\n");
            term.write(
              "   ______            __       ______        ____    \r\n"
            );
            term.write(
              "  / ____/____   ____/ /___   / ____/____ _ / __/___ \r\n"
            );
            term.write(
              " / /    / __ \\ / __  // _ \\ / /    / __ `// /_ / _ \\\r\n"
            );
            term.write(
              "/ /___ / /_/ // /_/ //  __// /___ / /_/ // __//  __/\r\n"
            );
            term.write(
              "\\____/ \\____/ \\__,_/ \\___/ \\____/ \\__,_//_/   \\___/\r\n"
            );
            term.write("\r\n");
          } else if (command.length > 0) {
            term.write(`Command not found: ${command}\r\n`);
            term.write("Type 'help' to see available commands.\r\n");
          }

          term.write("$ ");
        }
        // Handle backspace
        else if (data === "\x7f") {
          if (currentLineRef.current.length > 0) {
            currentLineRef.current = currentLineRef.current.substring(
              0,
              currentLineRef.current.length - 1
            );
            term.write("\b \b");
          }
        }
        // Handle normal input (printable characters)
        else if (data >= " " && data <= "~") {
          currentLineRef.current += data;
          term.write(data);
        }
      });
    }

    // Cleanup function
    return () => {
      if (terminalInstance.current) {
        terminalInstance.current.dispose();
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  useImperativeHandle(ref, () => ({
    writeToTerminal: (output: string) => {
      if (terminalInstance.current) {
        const term = terminalInstance.current;
        term.write("\x1b[2K\r"); // Clear the current line

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

    clear: () => {
      if (terminalInstance.current) {
        terminalInstance.current.clear();
        terminalInstance.current.write("$ ");
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

TerminalComponent.displayName = "TerminalComponent";

export default TerminalComponent;
