import { useEffect, useRef, useState } from 'react';

/** Keeps one server grade in flight and ignores a completion after unmount. */
export function useSingleActiveGrade() {
  const [pending, setPending] = useState(false);
  const active = useRef(false);
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current++; active.current = false; }, []);

  const grade = <Result,>(
    request: () => Result | Promise<Result>,
    onResult: (result: Result) => void,
    onFailure: () => void,
  ) => {
    if (active.current) return;
    active.current = true;
    const currentRequest = ++requestId.current;
    setPending(true);
    Promise.resolve().then(request).then((result) => {
      if (requestId.current === currentRequest) onResult(result);
    }).catch(() => {
      if (requestId.current === currentRequest) onFailure();
    }).finally(() => {
      if (requestId.current === currentRequest) {
        active.current = false;
        setPending(false);
      }
    });
  };

  return { pending, grade };
}
