import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CardContextType {
  isOpen: boolean;
  content: ReactNode | null;
  url: string | null;
  open: (content: ReactNode) => void;
  openUrl: (url: string) => void;
  close: () => void;
}

const CardContext = createContext<CardContextType>({
  isOpen: false,
  content: null,
  url: null,
  open: () => {},
  openUrl: () => {},
  close: () => {},
});

export function CardProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const open = useCallback((c: ReactNode) => {
    setContent(c);
    setUrl(null);
  }, []);

  const openUrl = useCallback((u: string) => {
    setUrl(u);
    setContent(null);
  }, []);

  const close = useCallback(() => {
    setContent(null);
    setUrl(null);
  }, []);

  return (
    <CardContext.Provider value={{ isOpen: content !== null || url !== null, content, url, open, openUrl, close }}>
      {children}
    </CardContext.Provider>
  );
}

export function useCard() {
  return useContext(CardContext);
}
