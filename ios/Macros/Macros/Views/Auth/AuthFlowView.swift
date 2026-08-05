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

                Button("Ainda não tens conta? Cria uma", action: onSwitchToRegister)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(AppColor.accent)
                    .frame(maxWidth: .infinity)

                serverField
            }
            .padding(24)
        }
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
            }
            .padding(24)
        }
    }
}
