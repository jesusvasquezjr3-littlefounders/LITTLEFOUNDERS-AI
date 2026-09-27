/* A stand-in for a wave-1 panel in the /family adapter test: it shows which panel it is and which child it was handed. */
export const panel = (name: string) => function PanelStub(props: { kidUserId?: string; onAccessLost?: () => void; inviteToken?: string }) {
  return <div data-copy-role="data" data-panel={name} data-kid={props.kidUserId ?? ''}>
    {name}
    {props.onAccessLost ? <button type="button" data-copy-role="action" onClick={props.onAccessLost}>lose access</button> : null}
    {props.inviteToken ? <span data-copy-role="data">{props.inviteToken}</span> : null}
  </div>;
};
