package com.androiduse.autopilot.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.androiduse.autopilot.model.Task
import com.androiduse.autopilot.R
import java.text.SimpleDateFormat
import java.util.*

class PreviousTasksAdapter(
    private val onTaskClick: (Task) -> Unit
) : RecyclerView.Adapter<PreviousTasksAdapter.TaskViewHolder>() {

    private val tasks = mutableListOf<Task>()

    class TaskViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val taskCommand: TextView = itemView.findViewById(R.id.taskCommand)
        val taskTime: TextView = itemView.findViewById(R.id.taskTime)
        val taskCard: View = itemView.findViewById(R.id.taskCard)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TaskViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_previous_task, parent, false)
        return TaskViewHolder(view)
    }

    override fun onBindViewHolder(holder: TaskViewHolder, position: Int) {
        val task = tasks[position]
        holder.taskCommand.text = task.goal
        holder.taskTime.text = formatTaskDuration(task)

        holder.taskCard.setOnClickListener {
            onTaskClick(task)
        }
    }

    override fun getItemCount(): Int = tasks.size

    fun updateTasks(newTasks: List<Task>) {
        tasks.clear()
        tasks.addAll(newTasks)
        notifyDataSetChanged()
    }

    private fun formatTaskDuration(task: Task): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            sdf.timeZone = TimeZone.getTimeZone("UTC")

            val createdDate = sdf.parse(task.createdAt)

            if (createdDate != null) {
                val relativeTime = formatRelativeTime(task.createdAt)

                // Calculate duration if task is completed
                if (task.completedAt != null) {
                    val completedDate = sdf.parse(task.completedAt)
                    if (completedDate != null) {
                        val durationMs = completedDate.time - createdDate.time
                        val duration = formatDuration(durationMs)
                        return "$duration • $relativeTime"
                    }
                } else {
                    // Task not completed yet, show status with relative time
                    val status = when (task.status.lowercase()) {
                        "pending" -> "Pending"
                        "running", "in_progress" -> "In progress..."
                        "failed" -> "Failed"
                        else -> task.status
                    }
                    return "$status • $relativeTime"
                }
            }

            // Fallback to relative time
            formatRelativeTime(task.createdAt)
        } catch (e: Exception) {
            formatRelativeTime(task.createdAt)
        }
    }

    private fun formatDuration(durationMs: Long): String {
        val seconds = durationMs / 1000
        val minutes = seconds / 60
        val hours = minutes / 60

        return when {
            seconds < 1 -> "< 1 sec"
            seconds < 60 -> "$seconds sec"
            minutes < 60 -> "$minutes min ${seconds % 60} sec"
            else -> "$hours hr ${minutes % 60} min"
        }
    }

    private fun formatRelativeTime(timestamp: String): String {
        return try {
            val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            val date = sdf.parse(timestamp)

            if (date != null) {
                val now = Date()
                val diff = now.time - date.time

                val minutes = diff / (60 * 1000)
                val hours = diff / (60 * 60 * 1000)
                val days = diff / (24 * 60 * 60 * 1000)

                when {
                    minutes < 1 -> "Just now"
                    minutes < 60 -> "$minutes min ago"
                    hours < 24 -> "$hours hr ago"
                    days < 7 -> "$days day${if (days > 1) "s" else ""} ago"
                    else -> SimpleDateFormat("MMM dd", Locale.getDefault()).format(date)
                }
            } else {
                timestamp
            }
        } catch (e: Exception) {
            timestamp
        }
    }
}
