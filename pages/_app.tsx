import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ApolloProvider } from "@apollo/client/react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { useState } from "react";
import { createApolloClient } from "@/lib/apollo/client";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export default function App({ Component, pageProps }: AppProps) {
  const [client] = useState(() => createApolloClient());

  return (
    <ApolloProvider client={client}>
      <div className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <Component {...pageProps} />
      </div>
    </ApolloProvider>
  );
}
