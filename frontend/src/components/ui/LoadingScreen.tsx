import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface LoadingScreenProps {
  title?: string;
  description?: string;
  loadingMessage: string;
  icon?: React.ReactNode;
  className?: string;
  minimal?: boolean;
}

export function LoadingScreen({
  title,
  description,
  loadingMessage,
  icon,
  className = "",
  minimal = false
}: LoadingScreenProps) {
  const { t } = useTranslation('common');

  const content = (
    <div className="flex flex-col items-center space-y-4">
      {icon || (
        <dotlottie-wc
          src="https://lottie.host/eac96c27-cdf7-40fa-a2b9-f709f50501de/RKfFgQWDLf.lottie"
          style={{ width: '300px', height: '300px' }}
          autoplay
          loop
        />
      )}
      <h2 className="corp-h2">{loadingMessage}</h2>
      <p className="corp-body max-w-md">
        {t('loading.please_wait')}
      </p>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {(title || description) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h1 className="corp-h2">{title}</h1>}
            {description && <p className="corp-body">{description}</p>}
          </div>
        </div>
      )}

      {minimal ? (
        <div className="text-center py-12">
          {content}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <CardContent>
            {content}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente específico para banca digital
export function BankingLoadingScreen() {
  const { t } = useTranslation(['common', 'dashboard']);
  return (
    <LoadingScreen
      title={t('dashboard:sidebar.digital_banking')}
      description={t('common:loading.verification_banking')}
      loadingMessage={t('common:loading.banking')}
    />
  );
}

// Componente específico para metas de ahorro
export function SavingsLoadingScreen() {
  const { t } = useTranslation(['common', 'dashboard']);
  return (
    <LoadingScreen
      title={t('dashboard:sidebar.my_savings')}
      description={t('common:loading.verification_savings')}
      loadingMessage={t('common:loading.savings')}
    />
  );
}

// Componente específico para lecciones
export function LessonsLoadingScreen({ minimal = true }: { minimal?: boolean }) {
  const { t } = useTranslation('common');
  return (
    <LoadingScreen
      loadingMessage={t('loading.lessons')}
      minimal={minimal}
    />
  );
}
