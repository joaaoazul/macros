import { LegalPage, LegalSection } from './legalShared'

export default function Privacidade() {
  return (
    <LegalPage title="Política de Privacidade" updated="11 de julho de 2026">
      <LegalSection title="1. Quem somos">
        O Macros (macros.joaoazul.dev) é operado por João Azul (joaoazul74@gmail.com), que atua como
        responsável pelo tratamento dos dados nos termos do RGPD.
      </LegalSection>
      <LegalSection title="2. Que dados guardamos">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Conta:</strong> email, nome e password (guardada com hash criptográfico — nunca em texto).</li>
          <li><strong>Perfil:</strong> sexo, idade, altura, peso, nível de atividade, objetivo e metas.</li>
          <li><strong>Registos:</strong> alimentos, água e exercício que registas, por dia.</li>
          <li><strong>Segurança:</strong> registos de acesso (data, ação e endereço IP) para proteger a tua conta.</li>
        </ul>
      </LegalSection>
      <LegalSection title="3. Para que usamos os dados">
        Exclusivamente para prestar o serviço: autenticar-te, guardar e sincronizar os teus registos e
        calcular as tuas metas. Não vendemos dados, não fazemos publicidade e não usamos os teus dados
        para outros fins. Base legal: execução do contrato (Art. 6.º/1-b RGPD) e interesse legítimo em
        segurança (Art. 6.º/1-f).
      </LegalSection>
      <LegalSection title="4. Onde ficam os dados">
        Os dados são guardados num servidor na União Europeia (Alemanha, Hetzner). As ligações são
        sempre cifradas (HTTPS).
      </LegalSection>
      <LegalSection title="5. Subcontratantes">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Hetzner Online GmbH</strong> (Alemanha) — alojamento do servidor.</li>
          <li><strong>Resend</strong> — envio de emails de confirmação e reposição de password (recebe apenas o teu email).</li>
          <li><strong>Open Food Facts</strong> — a pesquisa de alimentos é feita diretamente do teu dispositivo para
            pt.openfoodfacts.org; nós não enviamos dados teus a este serviço.</li>
        </ul>
      </LegalSection>
      <LegalSection title="6. Quanto tempo guardamos">
        Enquanto a tua conta existir. Ao eliminares a conta, todos os dados são apagados de imediato e
        permanentemente. Registos de segurança são mantidos até 12 meses.
      </LegalSection>
      <LegalSection title="7. Os teus direitos (RGPD)">
        Tens direito de acesso, retificação, portabilidade, limitação, oposição e apagamento. Na app:
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li><strong>Exportar os meus dados</strong> (Perfil) — descarrega tudo em JSON (Art. 20.º).</li>
          <li><strong>Eliminar conta</strong> (Perfil) — apaga tudo permanentemente (Art. 17.º).</li>
        </ul>
        Podes ainda apresentar reclamação à CNPD (cnpd.pt).
      </LegalSection>
      <LegalSection title="8. Cookies">
        Usamos apenas cookies estritamente necessários à sessão (autenticação, httpOnly e Secure). Não
        usamos cookies de análise, publicidade ou de terceiros.
      </LegalSection>
      <LegalSection title="9. Alterações">
        Se esta política mudar de forma relevante, avisamos-te na app ou por email.
      </LegalSection>
      <LegalSection title="10. Contacto">
        Questões de privacidade: joaoazul74@gmail.com.
      </LegalSection>
    </LegalPage>
  )
}
