import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

type RegistrationStep = 'tutor' | 'child' | 'sponsor' | 'success';

interface TutorData {
  email: string;
  name: string;
  birthDate: Date | undefined;
  gender: string;
}

interface ChildData {
  email: string;
  name: string;
  birthDate: Date | undefined;
  gender: string;
}

interface SponsorData {
  email: string;
  name: string;
  birthDate: Date | undefined;
  gender: string;
}

const Register = () => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('tutor');
  const [tutorData, setTutorData] = useState<TutorData>({
    email: "",
    name: "",
    birthDate: undefined,
    gender: "",
  });
  const [childData, setChildData] = useState<ChildData>({
    email: "",
    name: "",
    birthDate: undefined,
    gender: "",
  });
  const [sponsorData, setSponsorData] = useState<SponsorData>({
    email: "",
    name: "",
    birthDate: undefined,
    gender: "",
  });
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleTutorChange = (field: keyof TutorData, value: any) => {
    setTutorData(prev => ({ ...prev, [field]: value }));
  };

  const handleChildChange = (field: keyof ChildData, value: any) => {
    setChildData(prev => ({ ...prev, [field]: value }));
  };

  const handleSponsorChange = (field: keyof SponsorData, value: any) => {
    setSponsorData(prev => ({ ...prev, [field]: value }));
  };

  const validateTutorData = () => {
    if (!tutorData.email || !tutorData.name || !tutorData.birthDate || !tutorData.gender) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del tutor.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateChildData = () => {
    if (!childData.email || !childData.name || !childData.birthDate || !childData.gender) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del niño.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const validateSponsorData = () => {
    if (!sponsorData.email || !sponsorData.name || !sponsorData.birthDate || !sponsorData.gender) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del patrocinador.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 'tutor') {
      if (validateTutorData()) {
        setCurrentStep('child');
      }
    } else if (currentStep === 'child') {
      if (validateChildData()) {
        setCurrentStep('sponsor');
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep === 'child') {
      setCurrentStep('tutor');
    } else if (currentStep === 'sponsor') {
      setCurrentStep('child');
    }
  };

  const handleSponsorResponse = (wantsSponsor: boolean) => {
    if (wantsSponsor) {
      setShowSponsorForm(true);
    } else {
      handleFinalSubmit();
    }
  };

  const handleSponsorSubmit = () => {
    if (validateSponsorData()) {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Aquí iría la lógica para enviar todos los datos al backend
      // Por ahora simulamos un delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setCurrentStep('success');
      
      // Redirigir al dashboard después de 3 segundos
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
      
    } catch (error) {
      toast({
        title: "Error de registro",
        description: "No pudimos completar el registro. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderTutorForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tutor-email">Correo electrónico</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="tutor-email"
            type="email"
            placeholder="Ejemplo: tutor@email.com"
            value={tutorData.email}
            onChange={(e) => handleTutorChange('email', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tutor-name">Nombre completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="tutor-name"
            type="text"
            placeholder="Escribe tu nombre completo"
            value={tutorData.name}
            onChange={(e) => handleTutorChange('name', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

            <div className="space-y-2">
        <Label>Fecha de nacimiento</Label>
        <DatePicker
          selected={tutorData.birthDate}
          onSelect={(date) => handleTutorChange('birthDate', date)}
          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          placeholder="Selecciona tu fecha de nacimiento"
        />
      </div>

      <div className="space-y-2">
        <Label>Género</Label>
        <Select value={tutorData.gender} onValueChange={(value) => handleTutorChange('gender', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona tu género" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={handleNextStep}
        className="w-full bg-gradient-to-r from-primary to-customers hover:opacity-90"
      >
        Continuar
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderChildForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="child-email">Correo electrónico</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="child-email"
            type="email"
            placeholder="Ejemplo: niño@email.com"
            value={childData.email}
            onChange={(e) => handleChildChange('email', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="child-name">Nombre completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="child-name"
            type="text"
            placeholder="Escribe el nombre del niño"
            value={childData.name}
            onChange={(e) => handleChildChange('name', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

            <div className="space-y-2">
        <Label>Fecha de nacimiento</Label>
        <DatePicker
          selected={childData.birthDate}
          onSelect={(date) => handleChildChange('birthDate', date)}
          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          placeholder="Selecciona la fecha de nacimiento del niño"
        />
      </div>

      <div className="space-y-2">
        <Label>Género</Label>
        <Select value={childData.gender} onValueChange={(value) => handleChildChange('gender', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona el género" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex space-x-2">
        <Button 
          variant="outline"
          onClick={handlePreviousStep}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>
        <Button 
          onClick={handleNextStep}
          className="flex-1 bg-gradient-to-r from-primary to-customers hover:opacity-90"
        >
          Continuar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderSponsorQuestion = () => (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h3 className="text-lg font-semibold">¿Desea agregar a un patrocinador?</h3>
        <p className="text-sm text-muted-foreground">
          Un patrocinador puede ser un tío, tía o alguien que quiera formar parte del crecimiento del niño sin necesidad de ser sus padres o tutores
        </p>
      </div>

      <div className="flex space-x-4">
        <Button 
          variant="outline"
          onClick={handlePreviousStep}
          className="flex-1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Anterior
        </Button>
        <Button 
          onClick={() => handleSponsorResponse(false)}
          className="flex-1 bg-gradient-to-r from-primary to-customers hover:opacity-90"
          disabled={isLoading}
        >
          {isLoading ? "Procesando..." : "No"}
        </Button>
        <Button 
          onClick={() => handleSponsorResponse(true)}
          className="flex-1 bg-gradient-to-r from-primary to-customers hover:opacity-90"
          disabled={isLoading}
        >
          {isLoading ? "Procesando..." : "Sí"}
        </Button>
      </div>
    </div>
  );

  const renderSponsorForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sponsor-email">Correo electrónico</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="sponsor-email"
            type="email"
            placeholder="Ejemplo: patrocinador@email.com"
            value={sponsorData.email}
            onChange={(e) => handleSponsorChange('email', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sponsor-name">Nombre completo</Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="sponsor-name"
            type="text"
            placeholder="Escribe el nombre del patrocinador"
            value={sponsorData.name}
            onChange={(e) => handleSponsorChange('name', e.target.value)}
            className="pl-10"
            required
          />
        </div>
      </div>

            <div className="space-y-2">
        <Label>Fecha de nacimiento</Label>
        <DatePicker
          selected={sponsorData.birthDate}
          onSelect={(date) => handleSponsorChange('birthDate', date)}
          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
          placeholder="Selecciona la fecha de nacimiento del patrocinador"
        />
      </div>

      <div className="space-y-2">
        <Label>Género</Label>
        <Select value={sponsorData.gender} onValueChange={(value) => handleSponsorChange('gender', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona el género" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="masculino">Masculino</SelectItem>
            <SelectItem value="femenino">Femenino</SelectItem>
            <SelectItem value="otro">Otro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex space-x-2">
        <Button 
          variant="outline"
          onClick={() => setShowSponsorForm(false)}
          className="flex-1"
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSponsorSubmit}
          className="flex-1 bg-gradient-to-r from-primary to-customers hover:opacity-90"
          disabled={isLoading}
        >
          {isLoading ? "Procesando..." : "Completar registro"}
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <Check className="w-8 h-8 text-green-600" />
      </div>
      <div className="space-y-2">
        <h3 className="text-2xl font-bold text-green-600">¡Felicidades, bienvenido a tu nueva aventura!</h3>
        <p className="text-muted-foreground">
          Tu registro se ha completado exitosamente. Serás redirigido al dashboard en unos segundos...
        </p>
      </div>
    </div>
  );

  const getStepContent = () => {
    if (currentStep === 'tutor') {
      return renderTutorForm();
    } else if (currentStep === 'child') {
      return renderChildForm();
    } else if (currentStep === 'sponsor') {
      if (showSponsorForm) {
        return renderSponsorForm();
      } else {
        return renderSponsorQuestion();
      }
    } else if (currentStep === 'success') {
      return renderSuccess();
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 'tutor':
        return 'Datos de alta del padre o tutor';
      case 'child':
        return 'Datos de alta del niño';
      case 'sponsor':
        return showSponsorForm ? 'Datos del patrocinador' : '¿Agregar patrocinador?';
      case 'success':
        return '¡Registro completado!';
      default:
        return 'Registro';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'tutor':
        return 'Completa los datos del padre o tutor responsable';
      case 'child':
        return 'Completa los datos del niño que participará en LittleFounders';
      case 'sponsor':
        return showSponsorForm 
          ? 'Completa los datos del patrocinador'
          : 'Un patrocinador puede ser un tío, tía o alguien que quiera formar parte del crecimiento del niño';
      case 'success':
        return 'Tu cuenta ha sido creada exitosamente';
      default:
        return '';
    }
  };

  return (
    <AuthLayout
      title={getStepTitle()}
      description={getStepDescription()}
    >
      {getStepContent()}
      
      {currentStep !== 'success' && (
        <>
          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">o</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes una cuenta?{" "}
              <Link 
                to="/login" 
                className="font-medium text-primary hover:underline"
              >
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </>
      )}
    </AuthLayout>
  );
};

export default Register;
