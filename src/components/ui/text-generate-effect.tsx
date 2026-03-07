import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TextGenerateEffectProps {
  words: string;
  className?: string;
  /**
   * Index (0-based) of the first word that should be highlighted
   * with the primary gradient (e.g. "Web3 Wallets").
   * If not provided, no special highlight is applied.
   */
  highlightFromWord?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
    },
  },
};

const wordVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
};

export function TextGenerateEffect({
  words,
  className,
  highlightFromWord,
}: TextGenerateEffectProps) {
  const wordList = words.trim().split(/\s+/);

  return (
    <motion.span
      className={cn("inline-block", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {wordList.map((word, index) => {
        const isHighlighted =
          typeof highlightFromWord === "number" && index >= highlightFromWord;

        return (
          <motion.span
            key={`${word}-${index}`}
            variants={wordVariants}
            className={cn("inline-block whitespace-pre", isHighlighted && "text-gradient")}
          >
            {word}
            {index !== wordList.length - 1 ? " " : ""}
          </motion.span>
        );
      })}
    </motion.span>
  );
}

