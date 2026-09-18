package com.androiduse.autopilot.ui.settings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.events.model.EventType
import com.androiduse.autopilot.databinding.SheetSettingsBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.switchmaterial.SwitchMaterial

class SettingsBottomSheet : BottomSheetDialogFragment() {

    private lateinit var configManager: ConfigManager
    private var _binding: SheetSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = SheetSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        configManager = ConfigManager.Companion.getInstance(requireContext())

        // DISABLED: HTTP and WebSocket servers - only using BackendWebSocketClient now
        // Hide HTTP Server settings
        // binding.switchSocketServerEnabled.isChecked = configManager.socketServerEnabled
        // binding.switchSocketServerEnabled.setOnCheckedChangeListener { _, isChecked ->
        //     configManager.setSocketServerEnabledWithNotification(isChecked)
        // }
        //
        // binding.inputSocketServerPort.setText(configManager.socketServerPort.toString())
        // binding.inputSocketServerPort.setOnEditorActionListener { v, actionId, _ ->
        //     if (actionId == EditorInfo.IME_ACTION_DONE) {
        //         val port = v.text.toString().toIntOrNull()
        //         if (port != null && port in MIN_PORT..MAX_PORT) {
        //             configManager.setSocketServerPortWithNotification(port)
        //             binding.inputSocketServerPort.clearFocus()
        //         } else {
        //             binding.inputSocketServerPort.error = "Invalid Port"
        //         }
        //         true
        //     } else {
        //         false
        //     }
        // }
        //
        // // WebSocket Settings
        // binding.switchWsEnabled.isChecked = configManager.websocketEnabled
        // binding.switchWsEnabled.setOnCheckedChangeListener { _, isChecked ->
        //     configManager.setWebSocketEnabledWithNotification(isChecked)
        // }
        //
        // binding.inputWsPort.setText(configManager.websocketPort.toString())
        // binding.inputWsPort.setOnEditorActionListener { v, actionId, _ ->
        //     if (actionId == EditorInfo.IME_ACTION_DONE) {
        //         val port = v.text.toString().toIntOrNull()
        //         if (port != null && port in MIN_PORT..MAX_PORT) {
        //             configManager.setWebSocketPortWithNotification(port)
        //             binding.inputWsPort.clearFocus()
        //         } else {
        //             binding.inputWsPort.error = "Invalid Port"
        //         }
        //         true
        //     } else {
        //         false
        //     }
        // }

        // Event Filters
        setupEventToggle(binding.switchEventNotification, EventType.NOTIFICATION)
    }

    private fun setupEventToggle(
        switch: SwitchMaterial,
        type: EventType,
    ) {
        switch.isChecked = configManager.isEventEnabled(type)

        switch.setOnCheckedChangeListener { _, isChecked ->
            configManager.setEventEnabled(type, isChecked)
        }
    }

    companion object {
        const val TAG = "SettingsBottomSheet"
        private const val MIN_PORT = 1024
        private const val MAX_PORT = 65535
    }
}
