import React from "react";
import {
  Stethoscope,
  Scissors,
  BookOpen,
  Briefcase,
  Dumbbell,
  Wrench,
  Car,
  Grid2x2,
} from "lucide-react";

const iconMap = {
  stethoscope: Stethoscope,
  scissors: Scissors,
  "book-open": BookOpen,
  briefcase: Briefcase,
  barbell: Dumbbell,
  dumbbell: Dumbbell,
  wrench: Wrench,
  car: Car,
};

export default function CategoryIcon({ name, size = 26, className = "", strokeWidth = 1.75 }) {
  const Cmp = iconMap[name] || Grid2x2;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} />;
}
