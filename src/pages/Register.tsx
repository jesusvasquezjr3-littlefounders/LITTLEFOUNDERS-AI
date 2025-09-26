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
import { usePostHog } from "@/hooks/usePostHog";

type RegistrationStep = 'tutor' | 'child' | 'sponsor' | 'success';

interface TutorData {
  email: string;
  name: string;
  birthDate: Date | undefined;
  gender: string;
  password: string;
  confirmPassword: string;
}

interface ChildData {
  email: string;
  name: string;
  birthDate: Date | undefined;
  gender: string;
  password: string;
  confirmPassword: string;
}

interface SponsorData {
  email: string;
  name: string;
  birthDate: Date | undefined;
  gender: string;
  password: string;
  confirmPassword: string;
}

const Register = () => {
  const [currentStep, setCurrentStep] = useState<RegistrationStep>('tutor');
  const [tutorData, setTutorData] = useState<TutorData>({
    email: "",
    name: "",
    birthDate: undefined,
    gender: "",
    password: "",
    confirmPassword: "",
  });
  const [childData, setChildData] = useState<ChildData>({
    email: "",
    name: "",
    birthDate: undefined,
    gender: "",
    password: "",
    confirmPassword: "",
  });
  const [sponsorData, setSponsorData] = useState<SponsorData>({
    email: "",
    name: "",
    birthDate: undefined,
    gender: "",
    password: "",
    confirmPassword: "",
  });
  const [showTutorPassword, setShowTutorPassword] = useState(false);
  const [showTutorConfirmPassword, setShowTutorConfirmPassword] = useState(false);
  const [showChildPassword, setShowChildPassword] = useState(false);
  const [showChildConfirmPassword, setShowChildConfirmPassword] = useState(false);
  const [showSponsorPassword, setShowSponsorPassword] = useState(false);
  const [showSponsorConfirmPassword, setShowSponsorConfirmPassword] = useState(false);
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { trackEvent } = usePostHog();

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
    if (!tutorData.email || !tutorData.name || !tutorData.birthDate || !tutorData.gender || !tutorData.password || !tutorData.confirmPassword) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del tutor.",
        variant: "destructive",
      });
      return false;
    }

    if (tutorData.password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    if (tutorData.password !== tutorData.confirmPassword) {
      toast({
        title: "Contraseñas no coinciden",
        description: "Las contraseñas no coinciden. Por favor verifica.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const validateChildData = () => {
    if (!childData.email || !childData.name || !childData.birthDate || !childData.gender || !childData.password || !childData.confirmPassword) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del niño.",
        variant: "destructive",
      });
      return false;
    }

    if (childData.password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    if (childData.password !== childData.confirmPassword) {
      toast({
        title: "Contraseñas no coinciden",
        description: "Las contraseñas no coinciden. Por favor verifica.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const validateSponsorData = () => {
    if (!sponsorData.email || !sponsorData.name || !sponsorData.birthDate || !sponsorData.gender || !sponsorData.password || !sponsorData.confirmPassword) {
      toast({
        title: "Datos incompletos",
        description: "Por favor completa todos los campos del patrocinador.",
        variant: "destructive",
      });
      return false;
    }

    if (sponsorData.password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return false;
    }

    if (sponsorData.password !== sponsorData.confirmPassword) {
      toast({
        title: "Contraseñas no coinciden",
        description: "Las contraseñas no coinciden. Por favor verifica.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (currentStep === 'tutor') {
      if (validateTutorData()) {
        trackEvent('registration_step_completed', {
          step: 'tutor',
          timestamp: new Date().toISOString()
        });
        setCurrentStep('child');
      }
    } else if (currentStep === 'child') {
      if (validateChildData()) {
        trackEvent('registration_step_completed', {
          step: 'child',
          timestamp: new Date().toISOString()
        });
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
    trackEvent('sponsor_choice', {
      wants_sponsor: wantsSponsor,
      timestamp: new Date().toISOString()
    });
    
    if (wantsSponsor) {
      setShowSponsorForm(true);
    } else {
      handleFinalSubmit();
    }
  };

  const handleSponsorSubmit = () => {
    toast({
      title: "Procesando registro del patrocinador",
      description: "Validando datos del patrocinador...",
    });
    
    if (validateSponsorData()) {
      toast({
        title: "Datos válidos",
        description: "Enviando registro completo al servidor...",
      });
      handleFinalSubmit();
    } else {
      toast({
        title: "Error de validación",
        description: "Por favor revisa los datos del patrocinador.",
        variant: "destructive",
      });
    }
  };

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    
    try {
      // Prepare registration data
      const registrationData = {
        tutor: {
          email: tutorData.email,
          name: tutorData.name,
          password: tutorData.password,
          birth_date: tutorData.birthDate?.toISOString().split('T')[0],
          gender: tutorData.gender
        },
        child: {
          email: childData.email,
          name: childData.name,
          password: childData.password,
          birth_date: childData.birthDate?.toISOString().split('T')[0],
          gender: childData.gender
        },
        sponsor: showSponsorForm ? {
          email: sponsorData.email,
          name: sponsorData.name,
          password: sponsorData.password,
          birth_date: sponsorData.birthDate?.toISOString().split('T')[0],
          gender: sponsorData.gender
        } : null
      };

      // Send registration data to backend
      const response = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (response.ok) {
        // Track successful registration
        trackEvent('registration_success', {
          has_sponsor: showSponsorForm,
          timestamp: new Date().toISOString()
        });
        
        setCurrentStep('success');
        
        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        // Track registration error
        trackEvent('registration_failed', {
          error: data.detail || "Unknown error",
          timestamp: new Date().toISOString()
        });
        
        toast({
          title: "Error de registro",
          description: data.detail || "No pudimos completar el registro. Intenta de nuevo.",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      
      // Track connection error
      trackEvent('registration_error', {
        error: 'Connection error',
        timestamp: new Date().toISOString()
      });
      
      toast({
        title: "Error de conexión",
        description: "No pudimos conectar con el servidor. Intenta más tarde.",
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

      <div className="space-y-2">
        <Label htmlFor="tutor-password">Contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="tutor-password"
            type={showTutorPassword ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={tutorData.password}
            onChange={(e) => handleTutorChange('password', e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowTutorPassword(!showTutorPassword)}
          >
            {showTutorPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tutor-confirm-password">Confirmar contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="tutor-confirm-password"
            type={showTutorConfirmPassword ? "text" : "password"}
            placeholder="Repite la contraseña"
            value={tutorData.confirmPassword}
            onChange={(e) => handleTutorChange('confirmPassword', e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowTutorConfirmPassword(!showTutorConfirmPassword)}
          >
            {showTutorConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
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

      <div className="space-y-2">
        <Label htmlFor="child-password">Contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="child-password"
            type={showChildPassword ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={childData.password}
            onChange={(e) => handleChildChange('password', e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowChildPassword(!showChildPassword)}
          >
            {showChildPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="child-confirm-password">Confirmar contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="child-confirm-password"
            type={showChildConfirmPassword ? "text" : "password"}
            placeholder="Repite la contraseña"
            value={childData.confirmPassword}
            onChange={(e) => handleChildChange('confirmPassword', e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowChildConfirmPassword(!showChildConfirmPassword)}
          >
            {showChildConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
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

      <div className="space-y-2">
        <Label htmlFor="sponsor-password">Contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="sponsor-password"
            type={showSponsorPassword ? "text" : "password"}
            placeholder="Mínimo 6 caracteres"
            value={sponsorData.password}
            onChange={(e) => handleSponsorChange('password', e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowSponsorPassword(!showSponsorPassword)}
          >
            {showSponsorPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sponsor-confirm-password">Confirmar contraseña</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="sponsor-confirm-password"
            type={showSponsorConfirmPassword ? "text" : "password"}
            placeholder="Repite la contraseña"
            value={sponsorData.confirmPassword}
            onChange={(e) => handleSponsorChange('confirmPassword', e.target.value)}
            className="pl-10 pr-10"
            required
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowSponsorConfirmPassword(!showSponsorConfirmPassword)}
          >
            {showSponsorConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
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
        <h3 className="text-2xl font-bold text-green-600">¡Registro completado exitosamente!</h3>
        <p className="text-muted-foreground">
          Tu cuenta ha sido creada y guardada. Serás redirigido a la página de inicio de sesión en unos segundos...
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          ¡Ya puedes iniciar sesión con tu correo y contraseña para comenzar a usar LittleFounders!
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
