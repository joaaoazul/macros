import { LegalPage, LegalSection } from './legalShared'

export default function Termos() {
  return (
    <LegalPage title="Termos de Serviço" updated="11 de julho de 2026">
      <LegalSection title="1. O serviço">
        O Macros ("a app", disponível em macros.joaoazul.dev) é uma aplicação de registo de nutrição e
        macronutrientes. Permite calcular metas calóricas, registar refeições, água e exercício, e acompanhar o
        progresso ao longo do tempo.
      </LegalSection>
      <LegalSection title="2. A tua conta">
        Para usar a app precisas de criar uma conta com um email válido. És responsável por manter a
        confidencialidade da tua password e por toda a atividade na tua conta. Deves ter pelo menos 16 anos
        para criar conta.
      </LegalSection>
      <LegalSection title="3. Não é aconselhamento médico">
        Os valores calculados (calorias, macros, água) são estimativas baseadas em fórmulas padrão
        (Mifflin-St Jeor) e destinam-se apenas a fins informativos. A app não substitui aconselhamento
        médico, nutricional ou profissional. Consulta um profissional de saúde antes de alterar
        significativamente a tua alimentação, sobretudo se tiveres condições de saúde.
      </LegalSection>
      <LegalSection title="4. Dados de alimentos">
        A pesquisa de produtos usa a base de dados aberta Open Food Facts. Os valores nutricionais são
        fornecidos pela comunidade e podem conter erros — confirma sempre no rótulo do produto.
      </LegalSection>
      <LegalSection title="5. Utilização aceitável">
        Não podes usar a app para fins ilegais, tentar aceder a contas de terceiros, sobrecarregar ou
        interferir com o serviço, nem fazer engenharia inversa com fins maliciosos.
      </LegalSection>
      <LegalSection title="6. Disponibilidade e alterações">
        A app é fornecida "tal como está", sem garantias de disponibilidade contínua. Podemos alterar,
        suspender ou descontinuar funcionalidades. Faremos um esforço razoável para avisar com antecedência
        de alterações relevantes.
      </LegalSection>
      <LegalSection title="7. Eliminação de conta">
        Podes eliminar a tua conta a qualquer momento no Perfil. A eliminação remove permanentemente todos
        os teus dados dos nossos servidores.
      </LegalSection>
      <LegalSection title="8. Limitação de responsabilidade">
        Na medida máxima permitida por lei, não somos responsáveis por danos indiretos resultantes do uso
        da app, incluindo decisões alimentares tomadas com base nas estimativas apresentadas.
      </LegalSection>
      <LegalSection title="9. Lei aplicável">
        Estes termos regem-se pela lei portuguesa. Qualquer litígio será submetido aos tribunais
        portugueses competentes.
      </LegalSection>
      <LegalSection title="10. Contacto">
        Questões sobre estes termos: joaoazul74@gmail.com.
      </LegalSection>
    </LegalPage>
  )
}
