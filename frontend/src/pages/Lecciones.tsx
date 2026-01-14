import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Adventures } from "@/components/lessons/Adventures";
import { SagaView } from "@/components/lessons/SagaView";


const Lecciones = () => {
  const [selectedAgeRange, setSelectedAgeRange] = useState<string>("5-7");
  const [userAge, setUserAge] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAdventure, setSelectedAdventure] = useState<number | null>(null);
  const [userProgress] = useState({
    completed: 18,
    total: 50,
    points: 450,
    minutes: 120,
  });

  // Calculate user age automatically
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
          setIsLoading(false);
          return;
        }

        const user = JSON.parse(userStr);

        if (user.birth_date) {
          const birthDate = new Date(user.birth_date);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();

          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          setUserAge(age);

          // Determine age range
          let ageRange = "5-7";
          if (age >= 5 && age <= 7) {
            ageRange = "5-7";
          } else if (age >= 8 && age <= 9) {
            ageRange = "8-9";
          } else if (age >= 10 && age <= 12) {
            ageRange = "10-12";
          } else if (age >= 13 && age <= 14) {
            ageRange = "13-14";
          } else if (age >= 15 && age <= 17) {
            ageRange = "15-17";
          }
          setSelectedAgeRange(ageRange);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const ageRanges = [
    { id: "5-7", label: "5-7 años", description: "El Archipiélago del Trueque" },
    { id: "8-9", label: "8-9 años", description: "El Bosque de la Abundancia" },
    { id: "10-12", label: "10-12 años", description: "La Ciudad Digital" },
    { id: "13-14", label: "13-14 años", description: "El Valle de los Inventores" },
    { id: "15-17", label: "15-17 años", description: "El Reino de los Titanes" },
  ];

  const handleAdventureSelect = (adventureId: number) => {
    setSelectedAdventure(adventureId);
  };

  const handleBackToAdventures = () => {
    setSelectedAdventure(null);
  };

  // If viewing a specific adventure's sagas
  if (selectedAdventure !== null) {
    return (
      <DashboardLayout>
        <SagaView
          adventureId={selectedAdventure}
          onBack={handleBackToAdventures}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">


        {/* Adventures */}
        {!isLoading && (
          <Adventures onSelectAdventure={handleAdventureSelect} />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Lecciones;
