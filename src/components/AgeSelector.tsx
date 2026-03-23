import { Button } from "@/components/ui/button";

interface AgeSelectorProps {
  availableAges: number[];
  selectedAge: number;
  onAgeChange: (age: number) => void;
  orientation?: "left" | "right";
}

export const AgeSelector = ({ 
  availableAges, 
  selectedAge, 
  onAgeChange,
  orientation = "left" 
}: AgeSelectorProps) => {
  const ages = [1, 2, 3, 4];
  const ageLabels = ["I", "II", "III", "IV"];
  
  // If orientation is "left", reverse the order to display 1,2,3,4 from left to right
  const displayAges = orientation === "left" ? [...ages].reverse() : ages;
  const displayLabels = orientation === "left" ? [...ageLabels].reverse() : ageLabels;
  
  return (
    <div className={`flex ${orientation === "right" ? "flex-row" : "flex-row-reverse"} gap-2`}>
      {displayAges.map((age, index) => {
        const isAvailable = availableAges.includes(age);
        const isSelected = selectedAge === age;
        
        return (
          <Button
            key={age}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            disabled={!isAvailable}
            onClick={() => onAgeChange(age)}
            className={`
              w-12 h-12 text-lg font-serif
              ${!isAvailable ? "opacity-30 cursor-not-allowed" : ""}
              ${isSelected ? "bg-primary text-primary-foreground" : ""}
            `}
          >
            {displayLabels[index]}
          </Button>
        );
      })}
    </div>
  );
};
