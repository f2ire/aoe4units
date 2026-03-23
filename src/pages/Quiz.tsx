import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { aoe4Units, AoE4Unit } from "@/data/unified-units";
import { computeVersus } from "@/lib/combat";
import { UnitCard } from "@/components/UnitCard";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const Quiz = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const totalRounds = parseInt(searchParams.get("rounds") || "10");
  
  const [currentRound, setCurrentRound] = useState(1);
  const [score, setScore] = useState(0);
  const [matchup, setMatchup] = useState<{ unit1: AoE4Unit; unit2: AoE4Unit } | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const generateMatchup = () => {
    if (!aoe4Units || aoe4Units.length < 2) {
      console.error('Pas assez d\'unités pour générer un matchup');
      return;
    }
    const shuffled = [...aoe4Units].sort(() => Math.random() - 0.5);
    setMatchup({ unit1: shuffled[0], unit2: shuffled[1] });
    setFeedback(null);
  };

  useEffect(() => {
    if (aoe4Units && aoe4Units.length >= 2) {
      generateMatchup();
    }
  }, []);

  // Guard against unloaded data
  if (!aoe4Units || aoe4Units.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Erreur de chargement</h2>
          <p className="text-muted-foreground">Les données des unités n'ont pas pu être chargées.</p>
          <Button onClick={() => navigate("/")} className="mt-4">Retour à l'accueil</Button>
        </div>
      </div>
    );
  }

  if (!matchup) return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;

  const matchupWinner = computeVersus(matchup.unit1, matchup.unit2).winner;

  const handleChoice = (chosenUnitId: string) => {
    if (!matchup || feedback) return;

    const winner = matchupWinner;
    const isCorrect = winner === chosenUnitId || winner === "draw";

    setFeedback(isCorrect ? "correct" : "wrong");
    
    if (isCorrect) {
      setScore(score + 1);
      toast.success("Correct!", { duration: 1500 });
    } else {
      toast.error("Wrong!", { duration: 1500 });
    }

    setTimeout(() => {
      if (currentRound >= totalRounds) {
        navigate(`/results?score=${isCorrect ? score + 1 : score}&total=${totalRounds}`);
      } else {
        setCurrentRound(currentRound + 1);
        generateMatchup();
      }
    }, 1500);
  };

  if (!matchup) return null;


  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">Quiz Mode</h1>
          <p className="text-muted-foreground text-lg">
            Round {currentRound} of {totalRounds} | Score: {score}
          </p>
          <p className="text-foreground mt-4 text-xl">Which unit would win?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={matchup.unit1.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <UnitCard
                unit={matchup.unit1}
                side="left"
                onClick={() => handleChoice(matchup.unit1.id)}
                className={
                  feedback === "correct" && matchupWinner === matchup.unit1.id
                    ? "border-success"
                    : feedback === "wrong"
                    ? "opacity-50"
                    : ""
                }
              />
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={matchup.unit2.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              <UnitCard
                unit={matchup.unit2}
                side="right"
                onClick={() => handleChoice(matchup.unit2.id)}
                className={
                  feedback === "correct" && matchupWinner === matchup.unit2.id
                    ? "border-success"
                    : feedback === "wrong"
                    ? "opacity-50"
                    : ""
                }
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="text-center mt-8">
          <Button
            variant="secondary"
            onClick={() => navigate("/")}
          >
            End Quiz
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default Quiz;
