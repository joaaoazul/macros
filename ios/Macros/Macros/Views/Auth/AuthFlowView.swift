//
//  AuthFlowView.swift
//  Macros
//
//  Ecrãs de login/registo — equivalente nativo de src/pages/Login.tsx e
//  src/pages/Registo.tsx. A sessão fica em cookies HttpOnly (ver APIClient).
//

import SwiftUI

struct AuthFlowView: View {
    private enum Mode { case login, register }
    @State private var mode: Mode = .login

    var body: some View {
        VStack(spacing: 0) {
            switch mode {
            case .login:
                LoginView(onSwitchToRegister: { mode = .register })
            case .register:
                RegisterView(onSwitchToLogin: { mode = .login })
            }
        }
        .background(AppColor.bg.ignoresSafeArea())
    }
}

struct LoginView: View {
    var onSwitchToRegister: () -> Void

    @EnvironmentObject var auth: AuthService
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var showServer = false
    @State private var showForgotPassword = false
    @State private var serverURL = APIClient.shared.baseURLString

    private var valid: Bool { !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Macros 🥗").font(.system(size: 30, weight: .bold))
                    Text("Inicia sessão para continuar.").font(.system(size: 15)).foregroundStyle(AppColor.ink2)
                }
                .padding(.top, 40)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(MacrosFieldStyle())
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .textFieldStyle(MacrosFieldStyle())
                }

                if let error = auth.lastError {
                    Text(error).font(.system(size: 13)).foregroundStyle(AppColor.critical)
                }

                PrimaryButton(title: busy ? "A entrar…" : "Entrar", disabled: !valid || busy) {
                    Task {
                        busy = true
                        _ = await auth.login(email: email.trimmingCharacters(in: .whitespaces), password: password)
                        busy = false
                    }
                }

                VStack(spacing: 10) {
                    Button("Ainda não tens conta? Cria uma", action: onSwitchToRegister)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AppColor.accent)
                    Button("Esqueci-me da password") { showForgotPassword = true }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(AppColor.muted)
                }
                .frame(maxWidth: .infinity)

                LegalLinksFooter()

                serverField
            }
            .padding(24)
        }
        .sheet(isPresented: $showForgotPassword) { ForgotPasswordSheet() }
    }

    private var serverField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(showServer ? "Ocultar servidor" : "Servidor avançado…") { showServer.toggle() }
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(AppColor.muted)
            if showServer {
                TextField("https://…", text: $serverURL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(MacrosFieldStyle())
                    .onChange(of: serverURL) { _, newValue in
                        APIClient.shared.baseURLString = newValue
                    }
                Text("Por omissão: \(APIClient.defaultBaseURL)")
                    .font(.system(size: 11)).foregroundStyle(AppColor.muted)
            }
        }
        .padding(.top, 12)
    }
}

struct RegisterView: View {
    var onSwitchToLogin: () -> Void

    @EnvironmentObject var auth: AuthService
    @State private var name = ""
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false

    private var valid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !email.trimmingCharacters(in: .whitespaces).isEmpty
            && password.count >= 8
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Criar conta").font(.system(size: 30, weight: .bold))
                    Text("Os teus dados ficam guardados na tua conta e sincronizam entre dispositivos.")
                        .font(.system(size: 15)).foregroundStyle(AppColor.ink2)
                }
                .padding(.top, 40)

                VStack(spacing: 12) {
                    TextField("Nome", text: $name)
                        .textContentType(.name)
                        .textFieldStyle(MacrosFieldStyle())
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textFieldStyle(MacrosFieldStyle())
                    SecureField("Password (mín. 8 caracteres)", text: $password)
                        .textContentType(.newPassword)
                        .textFieldStyle(MacrosFieldStyle())
                }

                if let error = auth.lastError {
                    Text(error).font(.system(size: 13)).foregroundStyle(AppColor.critical)
                }

                PrimaryButton(title: busy ? "A criar…" : "Criar conta", disabled: !valid || busy) {
                    Task {
                        busy = true
                        _ = await auth.register(
                            email: email.trimmingCharacters(in: .whitespaces),
                            password: password,
                            name: name.trimmingCharacters(in: .whitespaces)
                        )
                        busy = false
                    }
                }

                Button("Já tens conta? Inicia sessão", action: onSwitchToLogin)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(AppColor.accent)
                    .frame(maxWidth: .infinity)

                LegalLinksFooter()
            }
            .padding(24)
        }
    }
}

/// Ligações para a Política de Privacidade e Termos de Serviço — a app web
/// já os serve (src/pages/Privacidade.tsx, Termos.tsx), por isso abrimos aí
/// em vez de duplicar o texto legal nesta app.
private struct LegalLinksFooter: View {
    var body: some View {
        HStack(spacing: 16) {
            Link("Termos de Serviço", destination: URL(string: "https://macros.joaoazul.dev/termos")!)
            Link("Política de Privacidade", destination: URL(string: "https://macros.joaoazul.dev/privacidade")!)
        }
        .font(.system(size: 11))
        .foregroundStyle(AppColor.muted)
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
        .padding(.top, 4)
    }
}

/// Pede o email de reposição de password (POST /auth/forgot-password). A
/// app não trata o link do email — abre no browser (página web já existente).
private struct ForgotPasswordSheet: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var busy = false
    @State private var resultMessage: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text("Escreve o email da tua conta. Se existir, enviamos uma ligação para repor a password.")
                    .font(.system(size: 14))
                    .foregroundStyle(AppColor.ink2)

                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textFieldStyle(MacrosFieldStyle())

                if let resultMessage {
                    Text(resultMessage).font(.system(size: 13)).foregroundStyle(AppColor.good)
                }
                if let errorMessage {
                    Text(errorMessage).font(.system(size: 13)).foregroundStyle(AppColor.critical)
                }

                PrimaryButton(title: busy ? "A enviar…" : "Enviar", disabled: email.trimmingCharacters(in: .whitespaces).isEmpty || busy) {
                    Task {
                        busy = true
                        errorMessage = nil
                        switch await auth.requestPasswordReset(email: email.trimmingCharacters(in: .whitespaces)) {
                        case .success(let message): resultMessage = message
                        case .failure(let message): errorMessage = message
                        }
                        busy = false
                    }
                }
                Spacer()
            }
            .padding(20)
            .background(AppColor.bg.ignoresSafeArea())
            .navigationTitle("Repor password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Fechar") { dismiss() } }
            }
        }
        .presentationDetents([.medium])
    }
}
